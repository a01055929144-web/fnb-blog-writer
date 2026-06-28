// F&B Lead Engine — Apps Script
// 기능: Claude API 호출 + 시트 저장 + 매주 2회 자동 글 작성 트리거
// 스크립트 속성 설정 필요:
//   ANTHROPIC_API_KEY = Claude API 키
//   SHEET_ID = Google Sheet ID

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// 시트 탭 구조
const SHEETS = {
  posts:    '작성글',
  keywords: '키워드',
  clusters: '토픽클러스터',
  projects: '프로젝트',
  schedule: '발행스케줄',
  regions:  '지역현황',
};

const POST_HEADERS = [
  '번호','날짜','지역','시/구','업종','콘텐츠타입',
  '제목','본문(500자)','해시태그','글자수','저장상태','블로그업로드'
];

/* ══════════════════════════════════════
   웹앱 엔드포인트
══════════════════════════════════════ */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');

    // Claude API 호출
    if (data.prompt) return output.setContent(JSON.stringify(callClaude_(data)));

    // 상태 업데이트
    if (data.action === 'updateStatus') return output.setContent(JSON.stringify(updatePostStatus_(data)));

    // 발행 스케줄 저장
    if (data.action === 'saveSchedule') return output.setContent(JSON.stringify(saveSchedule_(data)));

    // 글 저장
    return output.setContent(JSON.stringify(appendPost_(data)));

  } catch (err) {
    return output.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
}

function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  const props = PropertiesService.getScriptProperties();
  ensureAllSheets_();
  return output.setContent(JSON.stringify({
    success: true,
    service: 'fnb-blog-writer',
    message: 'F&B Lead Engine API 작동 중',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!getSheetId_(),
    sheets: Object.values(SHEETS),
    time: new Date().toISOString()
  }));
}

/* ══════════════════════════════════════
   Claude API 호출
══════════════════════════════════════ */
function callClaude_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 스크립트 속성에 없습니다.');

  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: data.model || ANTHROPIC_MODEL,
      max_tokens: data.max_tokens || 2000,
      messages: [{ role: 'user', content: data.prompt }]
    })
  });

  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  if (status < 200 || status >= 300) throw new Error('Claude API 오류 ' + status + ': ' + JSON.stringify(body));
  return { success: true, text: (body.content && body.content[0] && body.content[0].text) || '' };
}

/* ══════════════════════════════════════
   글 저장
══════════════════════════════════════ */
function appendPost_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);

  const rowNum = Math.max(sheet.getLastRow(), 1);
  const regionParts = (data.region || '').split(' ');
  const row = [
    rowNum,
    data.date || new Date().toLocaleDateString('ko-KR'),
    regionParts[0] || '',                          // 시/도
    regionParts.slice(1).join(' ') || '',          // 구/군
    data.industry || '',
    data.type || '',
    data.title || '',
    String(data.body || '').substring(0, 500),
    data.hashtags || '',
    data.chars || 0,
    data.status || '자동생성',
    '미발행'
  ];

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();

  // 행 스타일
  const rowRange = sheet.getRange(newRow, 1, 1, POST_HEADERS.length);
  if (newRow % 2 === 0) rowRange.setBackground('#F8FAFC');
  sheet.getRange(newRow, 12).setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');

  // 지역 현황 업데이트
  updateRegionSheet_(ss, data.region, data.industry, data.type);

  return { success: true, row: newRow };
}

/* ══════════════════════════════════════
   블로그 업로드 상태 업데이트
══════════════════════════════════════ */
function updatePostStatus_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);
  const lastRow = sheet.getLastRow();

  for (let r = 2; r <= lastRow; r++) {
    const cellTitle = sheet.getRange(r, 7).getValue();
    const cellKeyword = sheet.getRange(r, 4).getValue();
    if (cellTitle === data.title || cellKeyword === data.keyword) {
      const statusCell = sheet.getRange(r, 12);
      const newStatus = data.uploadStatus || '미발행';
      statusCell.setValue(newStatus);
      if (newStatus === '발행완료') {
        statusCell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      } else {
        statusCell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
      }
      return { success: true, updated: true, row: r };
    }
  }
  return { success: true, updated: false };
}

/* ══════════════════════════════════════
   지역 현황 시트 업데이트
══════════════════════════════════════ */
function updateRegionSheet_(ss, region, industry, type) {
  try {
    const sheet = ensureSheet_(ss, SHEETS.regions, ['지역','시도','구군','총글수','업종별현황','최종업데이트']);
    const lastRow = sheet.getLastRow();
    const regionParts = (region || '').split(' ');
    const sido = regionParts[0] || '';
    const gugun = regionParts.slice(1).join(' ') || '';

    // 기존 지역 찾기
    for (let r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === region) {
        const cnt = parseInt(sheet.getRange(r, 4).getValue() || 0) + 1;
        sheet.getRange(r, 4).setValue(cnt);
        sheet.getRange(r, 6).setValue(new Date().toLocaleDateString('ko-KR'));
        return;
      }
    }
    // 새 지역 추가
    sheet.appendRow([region, sido, gugun, 1, industry, new Date().toLocaleDateString('ko-KR')]);
  } catch(e) { Logger.log('지역현황 업데이트 실패: ' + e); }
}

/* ══════════════════════════════════════
   발행 스케줄 저장
══════════════════════════════════════ */
function saveSchedule_(data) {
  const ss = SpreadsheetApp.openById(getSheetId_());
  const sheet = ensureSheet_(ss, SHEETS.schedule, ['예약일','요일','업종','지역','키워드전략','상태','생성일']);
  sheet.appendRow([
    data.scheduleDate || '',
    data.dayOfWeek || '',
    data.industry || '',
    data.region || '',
    data.strategy || '',
    '대기중',
    new Date().toLocaleDateString('ko-KR')
  ]);
  return { success: true };
}

/* ══════════════════════════════════════
   ★ 매주 자동 글 작성 트리거 ★
   Apps Script 트리거로 실행:
   - 화요일 오전 9시
   - 금요일 오전 9시
══════════════════════════════════════ */
function weeklyAutoWrite() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) { Logger.log('API 키 없음'); return; }

  const ss = SpreadsheetApp.openById(getSheetId_());
  const postSheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);

  // 기존 작성된 키워드 수집 (중복 방지)
  const usedKeywords = new Set();
  const lastRow = postSheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    const kw = postSheet.getRange(r, 7).getValue(); // 제목
    if (kw) usedKeywords.add(kw.toLowerCase());
  }

  // 이번 주 작성할 키워드 전략
  // 지역 현황 시트에서 글이 부족한 지역 우선 선택
  const regionSheet = ss.getSheetByName(SHEETS.regions);
  let targetRegions = ['서울 강남구', '서울 마포구', '서울 송파구', '경기 수원시 팔달구', '인천 연수구'];

  if (regionSheet && regionSheet.getLastRow() > 1) {
    // 글 수가 적은 지역 우선
    const regionData = regionSheet.getRange(2, 1, regionSheet.getLastRow()-1, 4).getValues();
    const sorted = regionData.sort(function(a,b){ return a[3]-b[3]; });
    targetRegions = sorted.slice(0,5).map(function(r){ return r[0]; });
  }

  // 이번 주 작성 전략 (화요일=창업/신규, 금요일=원가절감/납품)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일,1=월,2=화,3=수,4=목,5=금,6=토
  const isTuesday = dayOfWeek === 2;

  const strategies = isTuesday
    ? ['창업 컨설팅', '정보성 SEO']   // 화요일: 창업/신규 오픈 타겟
    : ['원가절감', '납품 노하우'];     // 금요일: 기존 식당 타겟

  const industries = ['한식/축산', '일식/수산', '카페/베이커리', '중식', '주류'];

  let writeCount = 0;
  const maxPerRun = 4; // 1회 실행당 최대 4개 (API 비용 고려)

  for (let ri = 0; ri < targetRegions.length && writeCount < maxPerRun; ri++) {
    const region = targetRegions[ri];
    for (let si = 0; si < strategies.length && writeCount < maxPerRun; si++) {
      const type = strategies[si];
      const industry = industries[ri % industries.length];

      // 키워드 생성
      const kwPrompt = '다음 조합으로 네이버 SEO 롱테일 키워드 1개만 생성해줘. 키워드만 답해줘.\n'
        + '지역: ' + region + '\n업종: ' + industry + '\n타입: ' + type
        + '\n예시: "강남 삼겹살 납품업체 추천"';

      const kwResult = callClaude_({ prompt: kwPrompt, max_tokens: 50 });
      const kw = (kwResult.text || '').trim();
      if (!kw) continue;

      // 중복 체크
      if (usedKeywords.has(kw.toLowerCase())) continue;
      usedKeywords.add(kw.toLowerCase());

      // 글 작성
      const postPrompt = buildAutoPrompt_(kw, region, industry, type);
      const postResult = callClaude_({ prompt: postPrompt, max_tokens: 2000 });
      const text = postResult.text || '';
      if (!text) continue;

      // 파싱
      const titleM = text.match(/\*\*제목\*\*[:\s]*(.*)/);
      const title = titleM ? titleM[1].trim().replace(/\*\*/g,'') : kw;
      const hashM = text.match(/\*\*해시태그\*\*[:\s]*([\s\S]*?)$/);
      const tags = hashM ? hashM[1].trim().split(/[\s,\n]+/).filter(function(t){ return t.startsWith('#'); }).join(' ') : '';
      const body = text.replace(/\*\*제목\*\*.*\n?/,'').replace(/\*\*해시태그\*\*[\s\S]*$/,'').replace(/\*\*본문\*\*[:\s]*/,'').replace(/\*\*/g,'').trim();

      appendPost_({
        sheetId: getSheetId_(),
        date: today.toLocaleDateString('ko-KR'),
        region: region,
        industry: industry,
        type: type,
        title: title,
        body: body,
        hashtags: tags,
        chars: body.length,
        status: '자동예약'
      });

      writeCount++;
      Logger.log('자동 작성 완료: ' + title);
      Utilities.sleep(2000); // API 딜레이
    }
  }

  Logger.log('이번 주 자동 작성 완료: ' + writeCount + '개');
}

function buildAutoPrompt_(kw, region, industry, type) {
  const month = new Date().getMonth() + 1;
  const monthNames = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  return '당신은 F&B 식자재 중개 전문가이자 네이버 SEO 블로그 전문 작가입니다.\n\n'
    + '핵심 키워드: "' + kw + '"\n'
    + '지역: ' + region + '\n'
    + '업종: ' + industry + '\n'
    + '콘텐츠 타입: ' + type + '\n'
    + '작성 시점: ' + monthNames[month] + '\n\n'
    + '**제목**: "' + kw + '" 포함, 이모지 1-2개, 클릭 유도형\n\n'
    + '**본문** (2000자 이상):\n'
    + '[도입부 200자] ' + region + ' 식당 사장님 공감 포인트로 시작. ' + monthNames[month] + ' 시즌 반영.\n'
    + '[본론1 600자] ' + kw + ' 핵심 정보. 구체적 수치 포함.\n'
    + '[본론2 600자] 실전 원가절감/납품 노하우.\n'
    + '[본론3 400자] 체크리스트 3-5개.\n'
    + '[CTA 200자] 무료상담 강조. 카카오: https://open.kakao.com/o/shEOWEth\n\n'
    + '**해시태그**: #' + kw.replace(/\s/g,'') + ' 포함 20개\n\n'
    + '"' + kw + '" 키워드 4-6회 자연스럽게 반복. 소제목 **굵게**.';
}

/* ══════════════════════════════════════
   트리거 설정 함수 (최초 1회 실행)
   Apps Script 편집기에서 수동 실행 필요
══════════════════════════════════════ */
function setupWeeklyTriggers() {
  // 기존 트리거 모두 삭제
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // 화요일 오전 9시
  ScriptApp.newTrigger('weeklyAutoWrite')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(9)
    .create();

  // 금요일 오전 9시
  ScriptApp.newTrigger('weeklyAutoWrite')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(9)
    .create();

  Logger.log('트리거 설정 완료: 매주 화/금 오전 9시');
}

function deleteAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('모든 트리거 삭제 완료');
}

/* ══════════════════════════════════════
   시트 유틸리티
══════════════════════════════════════ */
function ensureAllSheets_() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  Object.keys(SHEETS).forEach(function(key) {
    if (key === 'posts') ensureSheet_(ss, SHEETS[key], POST_HEADERS);
    else ensureSheet_(ss, SHEETS[key], ['데이터']);
  });
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setBackground('#0F172A').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
