// F&B Lead Engine — Apps Script
// 기능: Claude API + 시트 저장 + 공공데이터 농수산물 단가 조회 + 주간 자동 발행
// 스크립트 속성 필요: ANTHROPIC_API_KEY, SHEET_ID

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const PRICE_API_KEY = 'b8ea502c6a13435db5d67932aa833a5d247d74be30c63b319f047b9907b42cdc';
const PRICE_API_BASE = 'https://apis.data.go.kr/B552845/perDay';

const SHEETS = {
  posts:   '작성글',
  price:   '단가데이터',
  regions: '지역현황',
  schedule:'발행스케줄',
};

const POST_HEADERS = [
  '번호','날짜','지역(시도)','시/구','업종','콘텐츠타입',
  '제목','본문(500자)','해시태그','글자수','저장상태','블로그업로드'
];

/* ══════════════════════════════════════
   웹앱 라우터
══════════════════════════════════════ */
function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');

    // Claude API 호출
    if (data.prompt !== undefined) {
      return out.setContent(JSON.stringify(callClaude_(data)));
    }
    // 단가 조회
    if (data.action === 'fetchPrice') {
      return out.setContent(JSON.stringify(fetchPriceData_(data)));
    }
    // 발행 상태 업데이트
    if (data.action === 'updateStatus') {
      return out.setContent(JSON.stringify(updateStatus_(data)));
    }
    // 글 저장
    return out.setContent(JSON.stringify(savePost_(data)));
  } catch (err) {
    return out.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
}

function doGet(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  const props = PropertiesService.getScriptProperties();
  ensureSheets_();

  // 단가 조회 GET
  if (e && e.parameter && e.parameter.action === 'fetchPrice') {
    return out.setContent(JSON.stringify(fetchPriceData_(e.parameter)));
  }

  return out.setContent(JSON.stringify({
    success: true,
    service: 'fnb-blog-writer',
    message: 'F&B Lead Engine API 작동 중',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!getSheetId_(),
    hasPriceApi: !!PRICE_API_KEY,
    sheets: Object.values(SHEETS),
    time: new Date().toISOString()
  }));
}

/* ══════════════════════════════════════
   Claude API 호출
══════════════════════════════════════ */
function callClaude_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 없습니다.');

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
  if (status < 200 || status >= 300) throw new Error('Claude API 오류 ' + status);
  return { success: true, text: (body.content && body.content[0] && body.content[0].text) || '' };
}

/* ══════════════════════════════════════
   공공데이터 농수산물 단가 조회
   한국농수산식품유통공사_일별 도소매 가격정보
══════════════════════════════════════ */
function fetchPriceData_(params) {
  var industry = params.industry || '한식/축산';
  var today = new Date();
  var endDay = Utilities.formatDate(today, 'Asia/Seoul', 'yyyyMMdd');
  var startDay = Utilities.formatDate(new Date(today - 7*24*60*60*1000), 'Asia/Seoul', 'yyyyMMdd');

  // 업종별 품목 코드 매핑
  var itemMap = {
    '한식/축산': [
      {code:'231', name:'돼지고기', part:'삼겹살'},
      {code:'211', name:'쇠고기', part:'등심'},
      {code:'241', name:'닭고기', part:'육계'},
    ],
    '일식/수산': [
      {code:'511', name:'고등어', part:''},
      {code:'512', name:'갈치', part:''},
      {code:'521', name:'오징어', part:''},
    ],
    '카페/베이커리': [
      {code:'121', name:'딸기', part:''},
      {code:'214', name:'방울토마토', part:''},
      {code:'131', name:'사과', part:''},
    ],
    '중식': [
      {code:'111', name:'배추', part:''},
      {code:'112', name:'무', part:''},
      {code:'221', name:'양파', part:''},
    ],
    '주류': [
      {code:'111', name:'배추', part:''},
      {code:'131', name:'사과', part:''},
    ],
    '양식/샐러드': [
      {code:'121', name:'딸기', part:''},
      {code:'214', name:'방울토마토', part:''},
      {code:'211', name:'파프리카', part:''},
    ],
    '신규창업': [
      {code:'231', name:'돼지고기', part:'삼겹살'},
      {code:'111', name:'배추', part:''},
    ],
    '소스/가공': [
      {code:'111', name:'배추', part:''},
      {code:'221', name:'양파', part:''},
    ]
  };

  var items = itemMap[industry] || itemMap['한식/축산'];
  var results = [];
  var savedToSheet = [];

  for (var i = 0; i < items.length; i++) {
    try {
      var item = items[i];
      var url = PRICE_API_BASE
        + '?serviceKey=' + PRICE_API_KEY
        + '&startDay=' + startDay
        + '&endDay=' + endDay
        + '&type=json'
        + '&itemCode=' + item.code;

      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var status = response.getResponseCode();

      if (status === 200) {
        var body = JSON.parse(response.getContentText());
        var priceItems = body && body.data && body.data.item ? body.data.item : [];

        if (priceItems.length > 0) {
          // 최신 데이터
          var latest = priceItems[priceItems.length - 1];
          var priceInfo = {
            name: item.name + (item.part ? ' ' + item.part : ''),
            wholesale: latest.dpr1 || '정보없음',  // 도매가
            retail: latest.dpr2 || '정보없음',      // 소매가
            date: latest.regday || endDay,
            unit: latest.unit || 'kg'
          };
          results.push(priceInfo);
          savedToSheet.push(priceInfo);
        }
      }
    } catch (e) {
      Logger.log('단가 조회 실패: ' + item.name + ' - ' + e);
    }
    Utilities.sleep(200); // API 호출 간격
  }

  // 단가 데이터 시트에 저장
  if (savedToSheet.length > 0) {
    try {
      var ss = SpreadsheetApp.openById(getSheetId_());
      var sheet = ensureSheet_(ss, SHEETS.price, ['날짜','품목','도매가','소매가','단위','업종']);
      var today_str = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');
      savedToSheet.forEach(function(p) {
        sheet.appendRow([today_str, p.name, p.wholesale, p.retail, p.unit, industry]);
      });
    } catch (e) {
      Logger.log('단가 시트 저장 실패: ' + e);
    }
  }

  return {
    success: true,
    industry: industry,
    date: endDay,
    prices: results,
    summary: results.map(function(p) {
      return p.name + ': 도매 ' + p.wholesale + '원/' + p.unit;
    }).join(', ')
  };
}

/* ══════════════════════════════════════
   글 저장
══════════════════════════════════════ */
function savePost_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);

  var region = (data.region || '').split(' ');
  var row = [
    sheet.getLastRow(),
    data.date || new Date().toLocaleDateString('ko-KR'),
    region[0] || '',
    region.slice(1).join(' ') || '',
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

  var newRow = sheet.getLastRow();
  if (newRow % 2 === 0) sheet.getRange(newRow, 1, 1, POST_HEADERS.length).setBackground('#F8FAFC');
  sheet.getRange(newRow, 12).setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');

  // 지역 현황 업데이트
  updateRegion_(ss, data.region, data.industry);

  return { success: true, row: newRow };
}

/* ══════════════════════════════════════
   발행 상태 업데이트
══════════════════════════════════════ */
function updateStatus_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r, 7).getValue() === data.title) {
      var cell = sheet.getRange(r, 12);
      var status = data.uploadStatus || '미발행';
      cell.setValue(status);
      if (status === '발행완료') {
        cell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      } else {
        cell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
      }
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
    var sheet = ensureSheet_(ss, SHEETS.regions,
      ['지역','시도','구군','총글수','업종','최종업데이트']);
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === region) {
        sheet.getRange(r, 4).setValue(parseInt(sheet.getRange(r, 4).getValue() || 0) + 1);
        sheet.getRange(r, 6).setValue(new Date().toLocaleDateString('ko-KR'));
        return;
      }
    }
    var parts = (region || '').split(' ');
    sheet.appendRow([region, parts[0] || '', parts.slice(1).join(' ') || '',
      1, industry, new Date().toLocaleDateString('ko-KR')]);
  } catch (e) { Logger.log('지역현황 오류: ' + e); }
}

/* ══════════════════════════════════════
   매주 자동 글 작성 (화/금 오전 9시)
══════════════════════════════════════ */
function weeklyAutoWrite() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ANTHROPIC_API_KEY')) return;

  var ss = SpreadsheetApp.openById(getSheetId_());
  var postSheet = ensureSheet_(ss, SHEETS.posts, POST_HEADERS);

  // 기존 제목 수집 (중복 방지)
  var usedTitles = new Set();
  for (var r = 2; r <= postSheet.getLastRow(); r++) {
    var t = postSheet.getRange(r, 7).getValue();
    if (t) usedTitles.add(t.toLowerCase());
  }

  // 글 부족한 지역 우선 선택
  var regionSheet = ss.getSheetByName(SHEETS.regions);
  var targets = ['서울 강남구', '서울 마포구', '서울 송파구', '경기 수원시', '인천 연수구'];
  if (regionSheet && regionSheet.getLastRow() > 1) {
    var rData = regionSheet.getRange(2, 1, regionSheet.getLastRow()-1, 4).getValues();
    targets = rData.sort(function(a,b){ return a[3]-b[3]; }).slice(0,5).map(function(r){ return r[0]; });
  }

  // 요일별 전략
  var day = new Date().getDay();
  var isTuesday = day === 2;
  var strategies = isTuesday
    ? ['창업 컨설팅', '정보성 SEO']
    : ['창업 컨설팅', '납품 노하우'];

  var industries = ['한식/축산', '일식/수산', '카페/베이커리', '중식', '주류'];
  var writeCount = 0;
  var maxWrite = 4;

  for (var ri = 0; ri < targets.length && writeCount < maxWrite; ri++) {
    var region = targets[ri];
    var industry = industries[ri % industries.length];

    // 실시간 단가 조회
    var priceResult = fetchPriceData_({ industry: industry });
    var priceContext = priceResult.success && priceResult.summary
      ? '\n[오늘 시세 ' + priceResult.date + '기준] ' + priceResult.summary
      : '';

    for (var si = 0; si < strategies.length && writeCount < maxWrite; si++) {
      var type = strategies[si];

      // 키워드 생성
      var kwPrompt = '네이버 SEO 롱테일 키워드 1개만 답해줘 (키워드만).\n'
        + '지역: ' + region + '\n업종: ' + industry + '\n타입: ' + type
        + (isTuesday ? '\n창업, 신규오픈 관련' : '\n신규창업자가 알면 좋은 정보');

      var kwResult = callClaude_({ prompt: kwPrompt, max_tokens: 30 });
      var kw = (kwResult.text || '').trim();
      if (!kw || usedTitles.has(kw.toLowerCase())) continue;

      // 글 작성 (실시간 단가 포함)
      var postPrompt = '당신은 F&B 식자재 전문가입니다.\n\n'
        + '[키워드] "' + kw + '"\n[지역] ' + region + '\n[업종] ' + industry + '\n[타입] ' + type
        + priceContext
        + '\n\n**제목**: "'+kw+'" 포함, 이모지, 구체적 수치\n\n'
        + '**본문** (2000자):\n[도입부][소제목1 단가정보+출처][소제목2 절감방법][소제목3 체크리스트][CTA]\n\n'
        + '**해시태그**: 20개\n\n단가는 제공된 실시간 시세 데이터 기반으로 작성.';

      var postResult = callClaude_({ prompt: postPrompt, max_tokens: 2000 });
      var text = postResult.text || '';
      if (!text) continue;

      var titleM = text.match(/\*\*제목\*\*[:\s]*(.*)/);
      var title = titleM ? titleM[1].trim().replace(/\*\*/g, '') : kw;
      var hashM = text.match(/\*\*해시태그\*\*[\s\S]*?$/);
      var tags = hashM ? hashM[0].replace(/\*\*해시태그\*\*/,'').trim() : '';
      var body = text.replace(/\*\*제목\*\*.*\n?/,'').replace(/\*\*해시태그\*\*[\s\S]*$/,'').replace(/\*\*/g,'').trim();

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

  ScriptApp.newTrigger('weeklyAutoWrite').timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(9).create();

  Logger.log('✅ 트리거 설정 완료: 매주 화/금 오전 9시');
}

/* ══════════════════════════════════════
   유틸리티
══════════════════════════════════════ */
function ensureSheets_() {
  var ss = SpreadsheetApp.openById(getSheetId_());
  ensureSheet_(ss, SHEETS.posts, POST_HEADERS);
  ensureSheet_(ss, SHEETS.price, ['날짜','품목','도매가','소매가','단위','업종']);
  ensureSheet_(ss, SHEETS.regions, ['지역','시도','구군','총글수','업종','최종업데이트']);
  ensureSheet_(ss, SHEETS.schedule, ['예약일','요일','업종','지역','키워드','상태']);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var h = sheet.getRange(1, 1, 1, headers.length);
    h.setBackground('#0F172A').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}
