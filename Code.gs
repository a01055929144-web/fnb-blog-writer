// F&B Lead Engine — Apps Script v4
// 시트: 작성글 / 단가데이터 / 지역현황
// 업종: 한식/양식/일식/중식/샐러드/주류/축산/수산/공산품/카페베이커리

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const PRICE_API_KEY = 'b8ea502c6a13435db5d67932aa833a5d247d74be30c63b319f047b9907b42cdc';
const PRICE_API_BASE = 'https://apis.data.go.kr/B552845/perDay';

const SHEET = {
  posts:   '작성글',
  price:   '단가데이터',
  regions: '지역현황'
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

/* 업종별 공공데이터 품목코드
   출처: 한국농수산식품유통공사 일별 도소매 가격정보 API */
const ITEM_MAP = {
  /* 축산 — 가락시장 축산물 경락가 기준 품목코드 */
  '축산': [
    {code: '211', name: '쇠고기 등심(1+등급)',  unit: '100g', cat: '축산'},
    {code: '212', name: '쇠고기 갈비(1+등급)',  unit: '100g', cat: '축산'},
    {code: '213', name: '쇠고기 설도',          unit: '100g', cat: '축산'},
    {code: '214', name: '쇠고기 앞다리',        unit: '100g', cat: '축산'},
    {code: '221', name: '돼지고기 삼겹살',      unit: '100g', cat: '축산'},
    {code: '222', name: '돼지고기 목심',        unit: '100g', cat: '축산'},
    {code: '223', name: '돼지고기 앞다리',      unit: '100g', cat: '축산'},
    {code: '224', name: '돼지고기 뒷다리',      unit: '100g', cat: '축산'},
    {code: '231', name: '닭고기 (생닭/육계)',   unit: 'kg',   cat: '축산'},
    {code: '232', name: '오리고기',             unit: 'kg',   cat: '축산'}
  ],
  /* 수산 — 노량진수산시장 도매가 기준 */
  '수산': [
    {code: '311', name: '고등어',      unit: 'kg',  cat: '수산'},
    {code: '312', name: '갈치',        unit: '마리', cat: '수산'},
    {code: '313', name: '조기',        unit: '마리', cat: '수산'},
    {code: '314', name: '삼치',        unit: 'kg',  cat: '수산'},
    {code: '321', name: '오징어',      unit: '마리', cat: '수산'},
    {code: '322', name: '낙지',        unit: '마리', cat: '수산'},
    {code: '323', name: '문어',        unit: 'kg',  cat: '수산'},
    {code: '331', name: '꽃게',        unit: 'kg',  cat: '수산'},
    {code: '332', name: '대하(새우)',  unit: 'kg',  cat: '수산'},
    {code: '341', name: '광어(활어)',  unit: 'kg',  cat: '수산'},
    {code: '342', name: '우럭(활어)',  unit: 'kg',  cat: '수산'},
    {code: '343', name: '참돔',        unit: 'kg',  cat: '수산'},
    {code: '351', name: '굴',          unit: 'kg',  cat: '수산'},
    {code: '352', name: '바지락',      unit: 'kg',  cat: '수산'},
    {code: '353', name: '홍합',        unit: 'kg',  cat: '수산'}
  ],
  /* 채소·과일 공통 코드 (여러 업종 공유) */
  '채소': [
    {code: '111', name: '배추',        unit: '포기', cat: '채소'},
    {code: '112', name: '무',          unit: '개',   cat: '채소'},
    {code: '113', name: '양배추',      unit: '포기', cat: '채소'},
    {code: '114', name: '시금치',      unit: 'kg',   cat: '채소'},
    {code: '115', name: '상추',        unit: '100g', cat: '채소'},
    {code: '121', name: '대파',        unit: 'kg',   cat: '채소'},
    {code: '122', name: '쪽파',        unit: 'kg',   cat: '채소'},
    {code: '131', name: '양파',        unit: 'kg',   cat: '채소'},
    {code: '132', name: '마늘(깐마늘)',unit: 'kg',   cat: '채소'},
    {code: '133', name: '생강',        unit: 'kg',   cat: '채소'},
    {code: '141', name: '고추(풋고추)',unit: 'kg',   cat: '채소'},
    {code: '142', name: '청양고추',    unit: 'kg',   cat: '채소'},
    {code: '143', name: '파프리카',    unit: 'kg',   cat: '채소'},
    {code: '151', name: '오이',        unit: '개',   cat: '채소'},
    {code: '152', name: '애호박',      unit: '개',   cat: '채소'},
    {code: '153', name: '가지',        unit: '개',   cat: '채소'},
    {code: '154', name: '토마토',      unit: 'kg',   cat: '채소'},
    {code: '155', name: '방울토마토',  unit: 'kg',   cat: '채소'},
    {code: '161', name: '감자',        unit: 'kg',   cat: '채소'},
    {code: '162', name: '고구마',      unit: 'kg',   cat: '채소'},
    {code: '171', name: '느타리버섯',  unit: 'kg',   cat: '채소'},
    {code: '172', name: '새송이버섯',  unit: 'kg',   cat: '채소'},
    {code: '173', name: '표고버섯',    unit: 'kg',   cat: '채소'},
    {code: '174', name: '팽이버섯',    unit: '봉',   cat: '채소'}
  ],
  '과일': [
    {code: '411', name: '사과',        unit: '개',   cat: '과일'},
    {code: '412', name: '배',          unit: '개',   cat: '과일'},
    {code: '413', name: '포도',        unit: 'kg',   cat: '과일'},
    {code: '414', name: '복숭아',      unit: '개',   cat: '과일'},
    {code: '421', name: '딸기',        unit: 'kg',   cat: '과일'},
    {code: '422', name: '수박',        unit: '개',   cat: '과일'},
    {code: '423', name: '참외',        unit: '개',   cat: '과일'},
    {code: '424', name: '멜론',        unit: '개',   cat: '과일'},
    {code: '431', name: '바나나',      unit: 'kg',   cat: '과일'},
    {code: '432', name: '오렌지',      unit: '개',   cat: '과일'},
    {code: '433', name: '레몬',        unit: '개',   cat: '과일'},
    {code: '434', name: '아보카도',    unit: '개',   cat: '과일'},
    {code: '441', name: '체리',        unit: 'kg',   cat: '과일'}
  ],
  '곡류': [
    {code: '511', name: '쌀(20kg)',    unit: '포',   cat: '곡류'},
    {code: '512', name: '찹쌀(20kg)', unit: '포',   cat: '곡류'},
    {code: '521', name: '밀가루(강력분,20kg)', unit: '포', cat: '곡류'},
    {code: '522', name: '밀가루(박력분,20kg)', unit: '포', cat: '곡류'}
  ],
  /* 업종별 매핑 — 위 공통 코드 참조 */
  '한식': [
    {code: '111', name: '배추',           unit: '포기', cat: '채소'},
    {code: '112', name: '무',             unit: '개',   cat: '채소'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '121', name: '대파',           unit: 'kg',   cat: '채소'},
    {code: '132', name: '마늘(깐마늘)',   unit: 'kg',   cat: '채소'},
    {code: '141', name: '고추(풋고추)',   unit: 'kg',   cat: '채소'},
    {code: '221', name: '돼지고기 삼겹살',unit: '100g', cat: '축산'},
    {code: '231', name: '닭고기 (생닭)',  unit: 'kg',   cat: '축산'},
    {code: '171', name: '느타리버섯',     unit: 'kg',   cat: '채소'},
    {code: '161', name: '감자',           unit: 'kg',   cat: '채소'}
  ],
  '양식': [
    {code: '154', name: '토마토',         unit: 'kg',   cat: '채소'},
    {code: '155', name: '방울토마토',     unit: 'kg',   cat: '채소'},
    {code: '143', name: '파프리카',       unit: 'kg',   cat: '채소'},
    {code: '421', name: '딸기',           unit: 'kg',   cat: '과일'},
    {code: '211', name: '쇠고기 등심',    unit: '100g', cat: '축산'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '132', name: '마늘(깐마늘)',   unit: 'kg',   cat: '채소'},
    {code: '434', name: '아보카도',       unit: '개',   cat: '과일'},
    {code: '172', name: '새송이버섯',     unit: 'kg',   cat: '채소'}
  ],
  '일식': [
    {code: '341', name: '광어(활어)',     unit: 'kg',   cat: '수산'},
    {code: '342', name: '우럭(활어)',     unit: 'kg',   cat: '수산'},
    {code: '311', name: '고등어',         unit: 'kg',   cat: '수산'},
    {code: '321', name: '오징어',         unit: '마리', cat: '수산'},
    {code: '331', name: '꽃게',           unit: 'kg',   cat: '수산'},
    {code: '332', name: '대하(새우)',     unit: 'kg',   cat: '수산'},
    {code: '121', name: '대파',           unit: 'kg',   cat: '채소'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '173', name: '표고버섯',       unit: 'kg',   cat: '채소'}
  ],
  '중식': [
    {code: '111', name: '배추',           unit: '포기', cat: '채소'},
    {code: '112', name: '무',             unit: '개',   cat: '채소'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '121', name: '대파',           unit: 'kg',   cat: '채소'},
    {code: '132', name: '마늘(깐마늘)',   unit: 'kg',   cat: '채소'},
    {code: '221', name: '돼지고기 삼겹살',unit: '100g', cat: '축산'},
    {code: '231', name: '닭고기 (생닭)',  unit: 'kg',   cat: '축산'},
    {code: '141', name: '고추(풋고추)',   unit: 'kg',   cat: '채소'},
    {code: '152', name: '애호박',         unit: '개',   cat: '채소'}
  ],
  '샐러드': [
    {code: '115', name: '상추',           unit: '100g', cat: '채소'},
    {code: '114', name: '시금치',         unit: 'kg',   cat: '채소'},
    {code: '113', name: '양배추',         unit: '포기', cat: '채소'},
    {code: '155', name: '방울토마토',     unit: 'kg',   cat: '채소'},
    {code: '143', name: '파프리카',       unit: 'kg',   cat: '채소'},
    {code: '151', name: '오이',           unit: '개',   cat: '채소'},
    {code: '434', name: '아보카도',       unit: '개',   cat: '과일'},
    {code: '421', name: '딸기',           unit: 'kg',   cat: '과일'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '433', name: '레몬',           unit: '개',   cat: '과일'}
  ],
  '주류': [],  // 제조사 납품가 중심 — 공공데이터 단가 해당 없음
  '카페베이커리': [],  // 원두·유제품·밀가루 제조사 납품가 중심 — 공공데이터 단가 해당 없음
  '공산품': [
    {code: '511', name: '쌀(20kg)',       unit: '포',   cat: '곡류'},
    {code: '521', name: '밀가루(강력분)', unit: '포',   cat: '곡류'},
    {code: '131', name: '양파',           unit: 'kg',   cat: '채소'},
    {code: '111', name: '배추',           unit: '포기', cat: '채소'},
    {code: '221', name: '돼지고기 삼겹살',unit: '100g', cat: '축산'},
    {code: '311', name: '고등어',         unit: 'kg',   cat: '수산'}
  ]
};

// 업종명 정규화 (index.html에서 오는 다양한 형식 처리)
function normalizeIndustry_(ind) {
  var s = (ind||'').toLowerCase().replace(/\//g,'').replace(/\s/g,'');
  if (s.includes('축산'))        return '축산';
  if (s.includes('수산'))        return '수산';
  if (s.includes('한식'))        return '한식';
  if (s.includes('일식'))        return '일식';
  if (s.includes('중식'))        return '중식';
  if (s.includes('양식'))        return '양식';
  if (s.includes('샐러드'))      return '샐러드';
  if (s.includes('주류'))        return '주류';
  if (s.includes('카페') || s.includes('베이커리')) return '카페베이커리';
  if (s.includes('공산품'))      return '공산품';
  return '한식'; // 기본값
}

/* ══════════════════════════════════════
   라우터
══════════════════════════════════════ */
function doPost(e) {
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    var raw = (e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);
    if (data.prompt !== undefined)        return out.setContent(JSON.stringify(callClaude_(data)));
    if (data.action === 'fetchPrice')     return out.setContent(JSON.stringify(fetchPrice_(data)));
    if (data.action === 'updateStatus')   return out.setContent(JSON.stringify(updateStatus_(data)));
    return out.setContent(JSON.stringify(savePost_(data)));
  } catch (err) {
    return out.setContent(JSON.stringify({success: false, message: err.toString()}));
  }
}

function doGet(e) {
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  if (e && e.parameter && e.parameter.action === 'fetchPrice') {
    return out.setContent(JSON.stringify(fetchPrice_(e.parameter)));
  }
  ensureAllSheets_();
  var props = PropertiesService.getScriptProperties();
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
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음');
  var res = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {'x-api-key': apiKey, 'anthropic-version': '2023-06-01'},
    payload: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: data.max_tokens || 2000,
      messages: [{role: 'user', content: data.prompt}]
    })
  });
  var status = res.getResponseCode();
  var body = JSON.parse(res.getContentText());
  if (status < 200 || status >= 300) {
    throw new Error('Claude API ' + status + ': ' + res.getContentText().substring(0, 100));
  }
  return {success: true, text: (body.content && body.content[0] && body.content[0].text) || ''};
}

/* ══════════════════════════════════════
   공공데이터 단가 조회
══════════════════════════════════════ */
function fetchPrice_(params) {
  var industry = params.industry || '한식';
  var key = normalizeIndustry_(industry);
  var items = ITEM_MAP[key] || [];
  if (!items.length) {
    return {success: true, industry: key, date: todayStr, prices: [],
      summary: key + '은(는) 공공데이터 단가 조회 대상 외 업종입니다. (제조사 납품가 별도 참고)'};
  }

  var today = new Date();
  var endDay   = Utilities.formatDate(today, 'Asia/Seoul', 'yyyyMMdd');
  var startDay = Utilities.formatDate(new Date(today.getTime() - 7*24*60*60*1000), 'Asia/Seoul', 'yyyyMMdd');
  var todayStr = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');

  var ss = SpreadsheetApp.openById(getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.price, PRICE_HEADERS);
  var results = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    try {
      var url = PRICE_API_BASE
        + '?serviceKey=' + PRICE_API_KEY
        + '&startDay=' + startDay
        + '&endDay=' + endDay
        + '&type=json'
        + '&itemCode=' + item.code;

      var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      if (res.getResponseCode() !== 200) continue;

      var d = JSON.parse(res.getContentText());
      var priceItems = (d && d.data && d.data.item) ? d.data.item : [];
      if (!priceItems.length) continue;

      var latest = priceItems[priceItems.length - 1];
      var info = {
        name:      item.name,
        wholesale: latest.dpr1 || '-',
        retail:    latest.dpr2 || '-',
        unit:      item.unit,
        date:      latest.regday || todayStr,
        prevDay:   latest.dpr3 || '-',
        prevYear:  latest.dpr7 || '-'
      };
      results.push(info);

      // 중복 없으면 시트 저장
      var lastRow = sheet.getLastRow();
      var alreadySaved = false;
      if (lastRow > 1) {
        var existing = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (var j = 0; j < existing.length; j++) {
          if (existing[j][0] === todayStr && existing[j][2] === item.name) {
            alreadySaved = true;
            break;
          }
        }
      }
      if (!alreadySaved) {
        sheet.appendRow([
          todayStr, key, item.name,
          info.wholesale, info.retail, item.unit,
          info.prevDay, info.prevYear,
          '공공데이터(한국농수산식품유통공사)'
        ]);
      }
    } catch (e) {
      Logger.log('단가 조회 실패: ' + item.name + ' - ' + e);
    }
    Utilities.sleep(200);
  }

  return {
    success: true,
    industry: key,
    date: todayStr,
    prices: results,
    summary: results.map(function(p) {
      return p.name + ': 도매 ' + p.wholesale + '원/' + p.unit
        + (p.retail !== '-' ? ' (소매 ' + p.retail + '원)' : '');
    }).join(' | ')
  };
}

/* ══════════════════════════════════════
   글 저장
══════════════════════════════════════ */
function savePost_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);

  var region = data.region || '';
  var sido  = data.sido  || region.split(' ')[0] || '';
  var gugun = data.gugun || region.split(' ').slice(1).join(' ') || '';

  var rowNum = sheet.getLastRow();
  sheet.appendRow([
    rowNum,
    data.date || new Date().toLocaleDateString('ko-KR'),
    sido,
    gugun,
    data.industry || '',
    data.type     || '',
    data.title    || '',
    String(data.body || '').substring(0, 500),
    data.hashtags || '',
    data.chars    || 0,
    data.status   || '자동생성',
    '미발행'
  ]);

  var newRow = sheet.getLastRow();
  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, POST_HEADERS.length).setBackground('#F8FAFC');
  }
  sheet.getRange(newRow, 12)
    .setBackground('#FEF3C7')
    .setFontColor('#92400E')
    .setFontWeight('bold');

  updateRegion_(ss, sido + (gugun ? ' ' + gugun : ''), data.industry);
  return {success: true, row: newRow};
}

/* ══════════════════════════════════════
   발행 상태 업데이트
══════════════════════════════════════ */
function updateStatus_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
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
      updateRegionPublish_(ss, r, status);
      return {success: true, updated: true, row: r};
    }
  }
  return {success: true, updated: false};
}

/* ══════════════════════════════════════
   지역 현황
══════════════════════════════════════ */
function updateRegion_(ss, region, industry) {
  if (!region.trim()) return;
  try {
    var sheet = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    var parts = region.split(' ');
    var today = new Date().toLocaleDateString('ko-KR');
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === region) {
        sheet.getRange(r, 4).setValue(parseInt(sheet.getRange(r, 4).getValue() || 0) + 1);
        sheet.getRange(r, 6).setValue(parseInt(sheet.getRange(r, 6).getValue() || 0) + 1);
        sheet.getRange(r, 8).setValue(today);
        return;
      }
    }
    sheet.appendRow([region, parts[0]||'', parts.slice(1).join(' ')||'', 1, 0, 1, industry||'', today]);
  } catch (e) { Logger.log('지역현황 오류: ' + e); }
}

function updateRegionPublish_(ss, postRow, status) {
  try {
    var postSheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
    var sido  = postSheet.getRange(postRow, 3).getValue();
    var gugun = postSheet.getRange(postRow, 4).getValue();
    var region = sido + (gugun ? ' ' + gugun : '');
    if (!region.trim()) return;

    var regSheet = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    var lastRow = regSheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (regSheet.getRange(r, 1).getValue() === region) {
        var done    = parseInt(regSheet.getRange(r, 5).getValue() || 0);
        var pending = parseInt(regSheet.getRange(r, 6).getValue() || 0);
        if (status === '발행완료') {
          regSheet.getRange(r, 5).setValue(done + 1);
          regSheet.getRange(r, 6).setValue(Math.max(0, pending - 1));
        } else {
          regSheet.getRange(r, 5).setValue(Math.max(0, done - 1));
          regSheet.getRange(r, 6).setValue(pending + 1);
        }
        break;
      }
    }
  } catch (e) { Logger.log('발행현황 업데이트 오류: ' + e); }
}

/* ══════════════════════════════════════
   주간 자동화 (화/금 오전 9시)
══════════════════════════════════════ */
function weeklyAutoWrite() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ANTHROPIC_API_KEY')) { Logger.log('API 키 없음'); return; }

  var ss = SpreadsheetApp.openById(getSheetId_());
  var postSheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);

  // 기존 제목 수집
  var usedTitles = {};
  for (var r = 2; r <= postSheet.getLastRow(); r++) {
    var t = String(postSheet.getRange(r, 7).getValue() || '').toLowerCase();
    if (t) usedTitles[t] = true;
  }

  // 글 부족한 지역 우선
  var targets = ['서울 강남구','서울 마포구','서울 송파구','경기 수원시','인천 연수구'];
  var regSheet = ss.getSheetByName(SHEET.regions);
  if (regSheet && regSheet.getLastRow() > 1) {
    var rData = regSheet.getRange(2, 1, regSheet.getLastRow()-1, 4).getValues();
    rData.sort(function(a, b) { return a[3] - b[3]; });
    targets = rData.slice(0, 5).map(function(r) { return r[0]; });
  }

  var day = new Date().getDay();
  var isTuesday = (day === 2);
  // 화: 창업 신규 타겟 / 금: 신규창업자 정보성
  var strategies = isTuesday
    ? ['창업 컨설팅', '정보성 SEO']
    : ['창업 컨설팅', '납품 노하우'];
  var industries = ['축산','수산','한식','일식','카페베이커리'];
  var writeCount = 0;
  var maxWrite = 4;

  for (var ri = 0; ri < targets.length && writeCount < maxWrite; ri++) {
    var region   = targets[ri];
    var industry = industries[ri % industries.length];

    // 실시간 단가
    var priceCtx = '';
    try {
      var pr = fetchPrice_({industry: industry});
      if (pr.success && pr.summary) {
        priceCtx = '\n[오늘 시세 ' + pr.date + ' 기준] ' + pr.summary;
      }
    } catch (e) {}

    for (var si = 0; si < strategies.length && writeCount < maxWrite; si++) {
      var type = strategies[si];

      // 키워드 생성
      var kwRes = callClaude_({
        prompt: '네이버 SEO 롱테일 키워드 1개만 답해줘 (키워드만).\n지역: '+region+'\n업종: '+industry+'\n타입: '+type+'\n신규 창업자 타겟.',
        max_tokens: 30
      });
      var kw = (kwRes.text || '').trim();
      if (!kw) continue;

      var postPrompt = '당신은 F&B 식자재 10년 전문가. 신규 창업 사장님 타겟 네이버 SEO 블로그 글.\n\n'
        + '[키워드] "' + kw + '"\n[지역] ' + region + '\n[업종] ' + industry + '\n[타입] ' + type
        + priceCtx
        + '\n\n**제목**: "' + kw + '" 포함, 이모지, 구체적 수치\n**본문** 2000자 이상:\n'
        + '[도입부][**소제목1** 단가+출처][**소제목2** 실전팁][**소제목3** 체크리스트]\n'
        + '[CTA] 카카오: https://open.kakao.com/o/shEOWEth\n**해시태그**: 20개\n\n'
        + '단가는 제공된 실시간 데이터만 사용. 임의 수치 금지.';

      var postRes = callClaude_({prompt: postPrompt, max_tokens: 2000});
      var text = postRes.text || '';
      if (!text) continue;

      var titleM = text.match(/\*\*제목\*\*[:\s]*(.*)/);
      var title = titleM ? titleM[1].trim().replace(/\*\*/g, '') : kw;
      if (usedTitles[title.toLowerCase()]) continue;

      var hashM = text.match(/\*\*해시태그\*\*[\s\S]*?$/);
      var tags  = hashM ? hashM[0].replace(/\*\*해시태그\*\*/, '').trim() : '';
      var body  = text.replace(/\*\*제목\*\*.*\n?/, '').replace(/\*\*해시태그\*\*[\s\S]*$/, '').replace(/\*\*/g, '').trim();

      savePost_({
        date: new Date().toLocaleDateString('ko-KR'),
        region: region, industry: industry, type: type,
        title: title, body: body, hashtags: tags,
        chars: body.length, status: '자동예약'
      });

      usedTitles[title.toLowerCase()] = true;
      writeCount++;
      Logger.log('자동 작성: ' + title);
      Utilities.sleep(2000);
    }
  }
  Logger.log('주간 자동화 완료: ' + writeCount + '개');
}

/* ══════════════════════════════════════
   트리거 설정
══════════════════════════════════════ */
function setupWeeklyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(9).create();
  Logger.log('트리거 설정 완료: 매주 화/금 오전 9시');
}

/* ══════════════════════════════════════
   유틸리티
══════════════════════════════════════ */
function ensureAllSheets_() {
  var ss = SpreadsheetApp.openById(getSheetId_());
  ensureSheet_(ss, SHEET.posts,   POST_HEADERS);
  ensureSheet_(ss, SHEET.price,   PRICE_HEADERS);
  ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    var h = sheet.getRange(1, 1, 1, headers.length);
    h.setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    if (name === SHEET.posts) {
      sheet.setColumnWidth(7, 280);
      sheet.setColumnWidth(8, 380);
      sheet.setColumnWidth(9, 240);
      sheet.setColumnWidth(12, 100);
    }
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}
