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
  regions: '지역현황',
  resto:   '맛집홍보'   // 맛집 홍보 콘텐츠 시트
};

// 맛집홍보 시트 헤더 (8컬럼)
const RESTO_HEADERS = [
  '번호', '날짜', '식당명', '위치', '채널', '제목', '콘텐츠', '발행상태'
];

// 작성글: 본문 전체 저장 (잘리지 않음), 발행상태 토글
const POST_HEADERS = [
  '번호', '날짜', '지역(시도)', '시/구', '업종', '콘텐츠타입',
  '핵심키워드', '제목', '본문(전체)', '해시태그', '글자수', '발행상태'
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
  // CORS: 브라우저 직접 호출 허용 (배포 시 "모든 사용자" 설정 필수)
  try {
    var raw = (e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);
    if (data.prompt !== undefined)        return out.setContent(JSON.stringify(callClaude_(data)));
    if (data.action === 'fetchPrice')     return out.setContent(JSON.stringify(fetchPrice_(data)));
    if (data.action === 'updateStatus')   return out.setContent(JSON.stringify(updateStatus_(data)));
    if (data.action === 'updatePost')     return out.setContent(JSON.stringify(updatePost_(data)));
    if (data.action === 'saveResto')      return out.setContent(JSON.stringify(saveResto_(data)));
    if (data.action === 'updateResto')    return out.setContent(JSON.stringify(updateResto_(data)));
    if (data.action === 'deleteResto')    return out.setContent(JSON.stringify(deleteResto_(data)));
    if (data.action === 'deletePost')     return out.setContent(JSON.stringify(deletePost_(data)));
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
  var rowNum = sheet.getLastRow(); // 번호 = 현재 마지막 행 번호

  // POST_HEADERS 12컬럼과 1:1 매핑
  var row = [
    rowNum,                                               // 1: 번호
    data.date || new Date().toLocaleDateString('ko-KR'),  // 2: 날짜
    sido,                                                 // 3: 지역(시도)
    gugun,                                                // 4: 시/구
    data.industry || '',                                  // 5: 업종
    data.type     || '',                                  // 6: 콘텐츠타입
    data.keyword  || data.kw || '',                       // 7: 핵심키워드
    data.title    || '',                                  // 8: 제목
    String(data.body || ''),                              // 9: 본문(전체) — 잘리지 않음
    data.hashtags || '',                                  // 10: 해시태그
    Number(data.chars) || 0,                             // 11: 글자수
    '미발행'                                              // 12: 발행상태
  ];

  sheet.appendRow(row);
  var newRow = sheet.getLastRow();

  // 짝수 행 배경색
  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, POST_HEADERS.length).setBackground('#F8FAFC');
  }
  // 발행상태(12번) 스타일
  sheet.getRange(newRow, 12)
    .setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
  // 본문(9번) 줄바꿈
  sheet.getRange(newRow, 9).setWrap(true);

  updateRegion_(ss, sido + (gugun ? ' ' + gugun : ''), data.industry);
  return {success: true, row: newRow};
}

/* ══════════════════════════════════════
   발행 상태 업데이트
══════════════════════════════════════ */

/* ══════════════════════════════════════
   글 수정 (제목/본문/해시태그 편집 → 시트 반영)
══════════════════════════════════════ */
function updatePost_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  // rowId로 찾기 (없으면 제목으로 fallback)
  var targetRow = -1;
  if (data.rowId) {
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() == data.rowId) { targetRow = r; break; }
    }
  }
  if (targetRow === -1 && data.oldTitle) {
    for (var r2 = 2; r2 <= lastRow; r2++) {
      if (sheet.getRange(r2, 8).getValue() === data.oldTitle) { targetRow = r2; break; }
    }
  }
  if (targetRow === -1) return {success: false, message: '해당 글을 찾을 수 없습니다'};

  // 수정된 필드만 업데이트
  if (data.title    !== undefined) sheet.getRange(targetRow, 8).setValue(data.title);
  if (data.body     !== undefined) sheet.getRange(targetRow, 9).setValue(data.body);
  if (data.hashtags !== undefined) sheet.getRange(targetRow, 10).setValue(data.hashtags);
  if (data.status   !== undefined) {
    var cell = sheet.getRange(targetRow, 12);
    cell.setValue(data.status);
    if (data.status === '발행완료') {
      cell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
    } else {
      cell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
    }
  }
  return {success: true, row: targetRow};
}

/* ══════════════════════════════════════
   글 삭제 (시트 행 삭제)
══════════════════════════════════════ */
/* ══════════════════════════════════════
   맛집홍보 저장/수정/삭제
══════════════════════════════════════ */
function saveResto_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var rowNum = sheet.getLastRow();
  sheet.appendRow([
    rowNum,
    data.date     || new Date().toLocaleDateString('ko-KR'),
    data.restName || '',
    data.location || '',
    data.channel  || '',
    data.title    || (data.restName + ' ' + data.channel),
    data.content  || '',
    '미발행'
  ]);
  var newRow = sheet.getLastRow();
  if (newRow % 2 === 0) sheet.getRange(newRow,1,1,RESTO_HEADERS.length).setBackground('#F8FAFC');
  sheet.getRange(newRow, 8).setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
  sheet.getRange(newRow, 7).setWrap(true);
  return {success: true, row: newRow};
}

function updateResto_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r,1).getValue() == data.rowId || sheet.getRange(r,6).getValue() === data.oldTitle) {
      targetRow = r; break;
    }
  }
  if (targetRow === -1) return {success: false, message: '찾을 수 없음'};
  if (data.content !== undefined) sheet.getRange(targetRow, 7).setValue(data.content);
  if (data.status  !== undefined) {
    var c = sheet.getRange(targetRow, 8);
    c.setValue(data.status);
    c.setBackground(data.status==='발행완료'?'#DCFCE7':'#FEF3C7')
     .setFontColor(data.status==='발행완료'?'#166534':'#92400E').setFontWeight('bold');
  }
  return {success: true, row: targetRow};
}

function deleteResto_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r,1).getValue() == data.rowId || sheet.getRange(r,6).getValue() === data.title) {
      sheet.deleteRow(r);
      return {success: true, deleted: true};
    }
  }
  return {success: false, message: '찾을 수 없음'};
}

function deletePost_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (data.rowId) {
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() == data.rowId) { targetRow = r; break; }
    }
  }
  if (targetRow === -1 && data.title) {
    for (var r2 = 2; r2 <= lastRow; r2++) {
      if (sheet.getRange(r2, 8).getValue() === data.title) { targetRow = r2; break; }
    }
  }
  if (targetRow === -1) return {success: false, message: '해당 글을 찾을 수 없습니다'};
  sheet.deleteRow(targetRow);
  return {success: true, deleted: true, row: targetRow};
}

function updateStatus_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r, 8).getValue() === data.title) { // 제목 8번 컬럼
      var cell = sheet.getRange(r, 12); // 발행상태 12번 컬럼
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
        keyword: kw, title: title, body: body, hashtags: tags,
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
   시트 정비 — 구버전 탭 삭제 + 빈 행 정리
   Apps Script 편집기에서 1회 수동 실행
══════════════════════════════════════ */
function cleanupSheets() {
  var ss = SpreadsheetApp.openById(getSheetId_());
  var keepSheets = ['작성글', '지역현황'];
  var sheets = ss.getSheets();

  // 1. 불필요한 탭 삭제
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (keepSheets.indexOf(name) === -1) {
      // 시트 하나는 남겨야 하므로 마지막 시트는 skip
      if (ss.getSheets().length > 1) {
        ss.deleteSheet(sheet);
        Logger.log('삭제: ' + name);
      }
    }
  });

  // 2. 작성글 탭 헤더 강제 재설정 (구버전 헤더 교체)
  var postSheet = ss.getSheetByName('작성글');
  if (!postSheet) {
    postSheet = ss.insertSheet('작성글');
  }
  // 헤더 행 강제 교체
  var correctHeaders = ['번호','날짜','지역(시도)','시/구','업종','콘텐츠타입',
    '핵심키워드','제목','본문(전체)','해시태그','글자수','발행상태'];
  postSheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
  var hdr = postSheet.getRange(1, 1, 1, correctHeaders.length);
  hdr.setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  postSheet.setFrozenRows(1);

  // 3. 빈 행 삭제 (제목이 없고 글자수=0인 행)
  var lastRow = postSheet.getLastRow();
  var toDelete = [];
  for (var r = lastRow; r >= 2; r--) {
    var titleVal = postSheet.getRange(r, 8).getValue();   // 8번: 제목
    var charsVal = postSheet.getRange(r, 11).getValue();  // 11번: 글자수
    if (!titleVal && (!charsVal || charsVal === 0)) {
      toDelete.push(r);
    }
  }
  // 배치 삭제 (역순)
  toDelete.sort(function(a,b){return b-a;});
  toDelete.forEach(function(r) { postSheet.deleteRow(r); });
  Logger.log('빈 행 ' + toDelete.length + '개 삭제');

  // 4. 실제 데이터 행 컬럼 확인 및 발행상태 열 정비
  var finalRow = postSheet.getLastRow();
  if (finalRow > 1) {
    for (var r2 = 2; r2 <= finalRow; r2++) {
      var statusCell = postSheet.getRange(r2, 12);
      var status = statusCell.getValue();
      if (!status || status === '자동생성' || status === '미발행') {
        statusCell.setValue('미발행')
          .setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
      } else if (status === '발행완료') {
        statusCell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      }
    }
  }

  // 5. 지역현황 탭 정비
  ensureSheet_(ss, '지역현황', [
    '지역', '시도', '시/구', '총글수', '발행완료', '미발행', '주요업종', '최종업데이트'
  ]);
  // 맛집홍보 탭
  var restoSheet = ensureSheet_(ss, '맛집홍보', ['번호','날짜','식당명','위치','채널','제목','콘텐츠','발행상태']);
  restoSheet.setColumnWidth(7, 500);
  restoSheet.setColumnWidth(6, 300);

  // 6. 헤더 스타일 재적용
  [postSheet].forEach(function(sh) {
    var hdr = sh.getRange(1, 1, 1, sh.getLastColumn());
    hdr.setBackground('#0F172A').setFontColor('#ffffff')
       .setFontWeight('bold').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  });

  Logger.log('✅ 시트 정비 완료: ' + postSheet.getLastRow() + '개 데이터 행');
  SpreadsheetApp.flush();
}

/* ══════════════════════════════════════
   유틸리티
══════════════════════════════════════ */
function ensureAllSheets_() {
  var ss = SpreadsheetApp.openById(getSheetId_());
  ensureSheet_(ss, SHEET.posts,   POST_HEADERS);
  ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
  ensureSheet_(ss, SHEET.resto,   RESTO_HEADERS);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    var h = sheet.getRange(1, 1, 1, headers.length);
    h.setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    if (name === SHEET.resto) {
      sheet.setColumnWidth(1, 50);
      sheet.setColumnWidth(3, 120);
      sheet.setColumnWidth(4, 150);
      sheet.setColumnWidth(5, 80);
      sheet.setColumnWidth(6, 280);
      sheet.setColumnWidth(7, 500);
      sheet.setColumnWidth(8, 80);
    }
    if (name === SHEET.posts) {
      sheet.setColumnWidth(1,  50);   // 번호
      sheet.setColumnWidth(2,  90);   // 날짜
      sheet.setColumnWidth(3,  70);   // 지역(시도)
      sheet.setColumnWidth(4,  70);   // 시/구
      sheet.setColumnWidth(5,  90);   // 업종
      sheet.setColumnWidth(6,  90);   // 콘텐츠타입
      sheet.setColumnWidth(7, 200);   // 핵심키워드
      sheet.setColumnWidth(8, 320);   // 제목
      sheet.setColumnWidth(9, 500);   // 본문(전체)
      sheet.setColumnWidth(10, 220);  // 해시태그
      sheet.setColumnWidth(11, 60);   // 글자수
      sheet.setColumnWidth(12, 80);   // 발행상태
    }
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}
