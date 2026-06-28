// F&B Lead Engine — Apps Script v3
// 시트: 작성글 / 단가데이터 / 지역현황 (3개만)
// 기능: Claude API + 공공데이터 단가 + 시트 저장 + 주간 자동화

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const PRICE_API_KEY = 'b8ea502c6a13435db5d67932aa833a5d247d74be30c63b319f047b9907b42cdc';
const PRICE_API_BASE = 'https://apis.data.go.kr/B552845/perDay';

// ── 시트 구조 (3개만) ──
const SHEET = {
  posts:   '작성글',
  price:   '단가데이터',
  regions: '지역현황',
};

const POST_HEADERS = [
  '번호', '날짜', '지역(시도)', '시/구', '업종', '콘텐츠타입',
  '제목', '본문(500자)', '해시태그', '글자수', '저장상태', '블로그업로드'
];

const PRICE_HEADERS = [
  '날짜', '업종', '품목명', '도매가(원)', '소매가(원)', '단위', '전일비', '전년비', '출처'
];

const REGION_HEADERS = [
  '지역', '시도', '시/구', '총글수', '발행완료', '미발행', '주요업종', '최종업데이트'
];

/* ══════════════════════════════════════
   라우터
══════════════════════════════════════ */
function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const raw = (e.postData && e.postData.contents) || '{}';
    const data = JSON.parse(raw);

    if (data.prompt !== undefined)        return out.setContent(JSON.stringify(callClaude_(data)));
    if (data.action === 'fetchPrice')     return out.setContent(JSON.stringify(fetchPrice_(data)));
    if (data.action === 'updateStatus')   return out.setContent(JSON.stringify(updateStatus_(data)));
    return out.setContent(JSON.stringify(savePost_(data)));

  } catch (err) {
    return out.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
}

function doGet(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  if (e && e.parameter && e.parameter.action === 'fetchPrice') {
    return out.setContent(JSON.stringify(fetchPrice_(e.parameter)));
  }
  ensureAllSheets_();
  const props = PropertiesService.getScriptProperties();
  return out.setContent(JSON.stringify({
    success: true,
    service: 'fnb-blog-writer',
    message: 'F&B Lead Engine API 작동 중',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!getSheetId_(),
    hasPriceApi: !!PRICE_API_KEY,
    sheets: Object.values(SHEET),
    time: new Date().toISOString()
  }));
}

/* ══════════════════════════════════════
   Claude API
══════════════════════════════════════ */
function callClaude_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음');
  const res = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post', muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: data.max_tokens || 2000,
      messages: [{ role: 'user', content: data.prompt }]
    })
  });
  const status = res.getResponseCode();
  const body = JSON.parse(res.getContentText());
  if (status < 200 || status >= 300) throw new Error('Claude API 오류 ' + status + ': ' + res.getContentText().substring(0,100));
  return { success: true, text: (body.content && body.content[0] && body.content[0].text) || '' };
}

/* ══════════════════════════════════════
   공공데이터 단가 조회
   한국농수산식품유통공사_일별 도소매 가격정보
══════════════════════════════════════ */
function fetchPrice_(params) {
  const industry = params.industry || '한식/축산';
  const today = new Date();
  const endDay = Utilities.formatDate(today, 'Asia/Seoul', 'yyyyMMdd');
  const startDay = Utilities.formatDate(new Date(today - 7*24*60*60*1000), 'Asia/Seoul', 'yyyyMMdd');

  // 업종별 품목코드
  const itemMap = {
    '한식/축산': [
      {code:'231', name:'돼지고기 삼겹살', unit:'100g'},
      {code:'211', name:'쇠고기 등심(1등급)', unit:'100g'},
      {code:'241', name:'닭고기 육계', unit:'kg'},
    ],
    '일식/수산': [
      {code:'511', name:'고등어', unit:'kg'},
      {code:'512', name:'갈치', unit:'마리'},
      {code:'521', name:'오징어', unit:'마리'},
    ],
    '카페/베이커리': [
      {code:'121', name:'딸기', unit:'kg'},
      {code:'131', name:'사과', unit:'개'},
      {code:'214', name:'방울토마토', unit:'kg'},
    ],
    '중식': [
      {code:'111', name:'배추', unit:'포기'},
      {code='221', name:'양파', unit:'kg'},
    ],
    '주류': [
      {code:'131', name:'사과', unit:'개'},
      {code:'121', name:'딸기', unit:'kg'},
    ],
    '양식/샐러드': [
      {code:'121', name:'딸기', unit:'kg'},
      {code:'214', name:'방울토마토', unit:'kg'},
    ],
    '신규창업': [
      {code:'231', name:'돼지고기 삼겹살', unit:'100g'},
      {code:'111', name:'배추', unit:'포기'},
    ],
    '소스/가공': [
      {code:'221', name:'양파', unit:'kg'},
      {code:'111', name:'배추', unit:'포기'},
    ],
  };

  const items = itemMap[industry] || itemMap['한식/축산'];
  const results = [];
  const ss = SpreadsheetApp.openById(getSheetId_());
  const sheet = ensureSheet_(ss, SHEET.price, PRICE_HEADERS);
  const todayStr = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');

  items.forEach(function(item) {
    try {
      const url = PRICE_API_BASE
        + '?serviceKey=' + PRICE_API_KEY
        + '&startDay=' + startDay
        + '&endDay=' + endDay
        + '&type=json'
        + '&itemCode=' + item.code;

      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return;

      const d = JSON.parse(res.getContentText());
      const priceItems = (d && d.data && d.data.item) ? d.data.item : [];
      if (!priceItems.length) return;

      const latest = priceItems[priceItems.length - 1];
      const info = {
        name: item.name,
        wholesale: latest.dpr1 || '-',
        retail:    latest.dpr2 || '-',
        unit:      item.unit,
        date:      latest.regday || todayStr,
        dpr3:      latest.dpr3 || '-', // 전일비
        dpr7:      latest.dpr7 || '-', // 전년비
      };
      results.push(info);

      // 시트에 저장 (중복 방지: 오늘 날짜 + 품목명 체크)
      const lastRow = sheet.getLastRow();
      let alreadySaved = false;
      if (lastRow > 1) {
        const existing = sheet.getRange(2, 1, lastRow-1, 3).getValues();
        alreadySaved = existing.some(function(r) {
          return r[0] === todayStr && r[2] === item.name;
        });
      }
      if (!alreadySaved) {
        sheet.appendRow([
          todayStr, industry, item.name,
          info.wholesale, info.retail, item.unit,
          info.dpr3, info.dpr7,
          '공공데이터(한국농수산식품유통공사)'
        ]);
      }

    } catch(e) {
      Logger.log('단가조회 실패: ' + item.name + ' - ' + e);
    }
    Utilities.sleep(200);
  });

  return {
    success: true,
    industry: industry,
    date: todayStr,
    prices: results,
    summary: results.map(function(p) {
      return p.name + ': 도매 ' + p.wholesale + '원/' + p.unit + ' (소매 ' + p.retail + '원)';
    }).join(' | ')
  };
}

/* ══════════════════════════════════════
   글 저장
══════════════════════════════════════ */
function savePost_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);

  // 시도/구군 분리
  const sido = data.sido || (data.region||'').split(' ')[0] || '';
  const gugun = data.gugun || (data.region||'').split(' ').slice(1).join(' ') || '';

  const rowNum = sheet.getLastRow(); // 헤더 포함
  const row = [
    rowNum,                                              // 번호
    data.date || new Date().toLocaleDateString('ko-KR'),// 날짜
    sido,                                               // 지역(시도)
    gugun,                                              // 시/구
    data.industry || '',                                // 업종
    data.type || '',                                    // 콘텐츠타입
    data.title || '',                                   // 제목
    String(data.body || '').substring(0, 500),          // 본문(500자)
    data.hashtags || '',                                // 해시태그
    data.chars || 0,                                    // 글자수
    data.status || '자동생성',                          // 저장상태
    '미발행'                                            // 블로그업로드
  ];

  sheet.appendRow(row);
  const newRow = sheet.getLastRow();

  // 스타일
  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, POST_HEADERS.length).setBackground('#F8FAFC');
  }
  // 블로그업로드 셀 스타일
  sheet.getRange(newRow, 12)
    .setBackground('#FEF3C7')
    .setFontColor('#92400E')
    .setFontWeight('bold');

  // 지역 현황 업데이트
  updateRegion_(ss, data.region || sido+' '+gugun, data.industry);

  return { success: true, row: newRow };
}

/* ══════════════════════════════════════
   발행 상태 업데이트
══════════════════════════════════════ */
function updateStatus_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  const lastRow = sheet.getLastRow();

  for (let r = 2; r <= lastRow; r++) {
    const cellTitle = sheet.getRange(r, 7).getValue();
    if (cellTitle === data.title) {
      const cell = sheet.getRange(r, 12);
      const status = data.uploadStatus || '미발행';
      cell.setValue(status);
      if (status === '발행완료') {
        cell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      } else {
        cell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
      }
      // 지역 현황 발행 수 업데이트
      updateRegionPublish_(ss, data.title, status);
      return { success: true, updated: true, row: r };
    }
  }
  return { success: true, updated: false };
}

/* ══════════════════════════════════════
   지역 현황 시트 업데이트
══════════════════════════════════════ */
function updateRegion_(ss, region, industry) {
  try {
    const sheet = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    const lastRow = sheet.getLastRow();
    const today = new Date().toLocaleDateString('ko-KR');
    const parts = (region||'').split(' ');

    for (let r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === region) {
        const cnt = parseInt(sheet.getRange(r, 4).getValue() || 0) + 1;
        const pending = parseInt(sheet.getRange(r, 6).getValue() || 0) + 1;
        sheet.getRange(r, 4).setValue(cnt);
        sheet.getRange(r, 6).setValue(pending);
        sheet.getRange(r, 8).setValue(today);
        return;
      }
    }
    sheet.appendRow([region, parts[0]||'', parts.slice(1).join(' ')||'', 1, 0, 1, industry, today]);
  } catch(e) { Logger.log('지역현황 오류: ' + e); }
}

function updateRegionPublish_(ss, title, status) {
  try {
    const postSheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
    const regionSheet = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    const lastPost = postSheet.getLastRow();
    let region = '';
    for (let r = 2; r <= lastPost; r++) {
      if (postSheet.getRange(r, 7).getValue() === title) {
        region = (postSheet.getRange(r, 3).getValue() + ' ' + postSheet.getRange(r, 4).getValue()).trim();
        break;
      }
    }
    if (!region) return;
    const lastReg = regionSheet.getLastRow();
    for (let r = 2; r <= lastReg; r++) {
      if (regionSheet.getRange(r, 1).getValue() === region) {
        if (status === '발행완료') {
          const done = parseInt(regionSheet.getRange(r, 5).getValue() || 0) + 1;
          const pending = Math.max(0, parseInt(regionSheet.getRange(r, 6).getValue() || 0) - 1);
          regionSheet.getRange(r, 5).setValue(done);
          regionSheet.getRange(r, 6).setValue(pending);
        } else {
          const done = Math.max(0, parseInt(regionSheet.getRange(r, 5).getValue() || 0) - 1);
          const pending = parseInt(regionSheet.getRange(r, 6).getValue() || 0) + 1;
          regionSheet.getRange(r, 5).setValue(done);
          regionSheet.getRange(r, 6).setValue(pending);
        }
        break;
      }
    }
  } catch(e) { Logger.log('발행현황 업데이트 오류: ' + e); }
}

/* ══════════════════════════════════════
   주간 자동화 트리거 (화/금 오전 9시)
══════════════════════════════════════ */
function weeklyAutoWrite() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ANTHROPIC_API_KEY')) { Logger.log('API 키 없음'); return; }

  const ss = SpreadsheetApp.openById(getSheetId_());
  const postSheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);

  // 기존 제목 수집 (중복 방지)
  const usedTitles = new Set();
  for (let r = 2; r <= postSheet.getLastRow(); r++) {
    const t = postSheet.getRange(r, 7).getValue();
    if (t) usedTitles.add(String(t).toLowerCase());
  }

  // 글 부족한 지역 우선
  const regionSheet = ss.getSheetByName(SHEET.regions);
  let targets = ['서울 강남구','서울 마포구','서울 송파구','경기 수원시','인천 연수구'];
  if (regionSheet && regionSheet.getLastRow() > 1) {
    const data = regionSheet.getRange(2,1,regionSheet.getLastRow()-1,4).getValues();
    targets = data.sort(function(a,b){ return a[3]-b[3]; }).slice(0,5).map(function(r){ return r[0]; });
  }

  const day = new Date().getDay();
  const isTuesday = (day === 2);
  const strategies = isTuesday
    ? ['창업 컨설팅', '정보성 SEO']
    : ['창업 컨설팅', '납품 노하우'];

  const industries = ['한식/축산','일식/수산','카페/베이커리','중식','주류'];
  let writeCount = 0;
  const maxWrite = 4;

  for (let ri = 0; ri < targets.length && writeCount < maxWrite; ri++) {
    const region = targets[ri];
    const industry = industries[ri % industries.length];

    // 실시간 단가
    let priceContext = '';
    try {
      const pr = fetchPrice_({ industry: industry });
      if (pr.success && pr.summary) {
        priceContext = '\n[오늘 시세 ' + pr.date + ' 기준] ' + pr.summary;
      }
    } catch(e) {}

    for (let si = 0; si < strategies.length && writeCount < maxWrite; si++) {
      const type = strategies[si];

      // 키워드 생성
      const kwResult = callClaude_({
        prompt: '네이버 SEO 롱테일 키워드 1개만 답해줘 (키워드만).\n지역: '+region+'\n업종: '+industry+'\n타입: '+type+'\n신규 창업자 타겟.',
        max_tokens: 30
      });
      const kw = (kwResult.text || '').trim();
      if (!kw) continue;

      // 글 작성
      const postPrompt = '당신은 F&B 식자재 10년 전문가. 신규 창업 사장님 타겟 네이버 SEO 블로그 글 작성.\n\n'
        + '[키워드] "'+kw+'"\n[지역] '+region+'\n[업종] '+industry+'\n[타입] '+type
        + priceContext
        + '\n\n**제목**: "'+kw+'" 포함, 이모지, 구체적 수치\n**본문** 2000자:\n[도입부][소제목1 단가+출처][소제목2 실전팁][소제목3 체크리스트][CTA: https://open.kakao.com/o/shEOWEth]\n**해시태그**: 20개\n\n단가는 제공 데이터만 사용.';

      const postResult = callClaude_({ prompt: postPrompt, max_tokens: 2000 });
      const text = postResult.text || '';
      if (!text) continue;

      const titleM = text.match(/\*\*제목\*\*[:\s]*(.*)/);
      const title = titleM ? titleM[1].trim().replace(/\*\*/g,'') : kw;
      if (usedTitles.has(title.toLowerCase())) continue;

      const hashM = text.match(/\*\*해시태그\*\*[\s\S]*?$/);
      const tags = hashM ? hashM[0].replace(/\*\*해시태그\*\*/,'').trim() : '';
      const body = text.replace(/\*\*제목\*\*.*\n?/,'').replace(/\*\*해시태그\*\*[\s\S]*$/,'').replace(/\*\*/g,'').trim();

      savePost_({
        date: new Date().toLocaleDateString('ko-KR'),
        region: region, industry: industry, type: type,
        title: title, body: body, hashtags: tags,
        chars: body.length, status: '자동예약'
      });

      usedTitles.add(title.toLowerCase());
      writeCount++;
      Logger.log('자동 작성: ' + title);
      Utilities.sleep(2000);
    }
  }
  Logger.log('주간 자동화 완료: ' + writeCount + '개');
}

/* ══════════════════════════════════════
   트리거 설정 (최초 1회 수동 실행)
══════════════════════════════════════ */
function setupWeeklyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(9).create();
  Logger.log('✅ 트리거 설정: 매주 화/금 오전 9시');
}

/* ══════════════════════════════════════
   유틸리티
══════════════════════════════════════ */
function ensureAllSheets_() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  ensureSheet_(ss, SHEET.posts,   POST_HEADERS);
  ensureSheet_(ss, SHEET.price,   PRICE_HEADERS);
  ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const h = sheet.getRange(1, 1, 1, headers.length);
    h.setBackground('#0F172A').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    // 열 너비 자동 조정
    sheet.setColumnWidth(1, 50);
    if (name === SHEET.posts) {
      sheet.setColumnWidth(7, 300); // 제목
      sheet.setColumnWidth(8, 400); // 본문
      sheet.setColumnWidth(9, 250); // 해시태그
    }
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}
