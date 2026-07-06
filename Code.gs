// F&B Lead Engine — Apps Script v5
// 수정: 1) cleanupSheets keepSheets에 맛집홍보 추가 (삭제 방지)
//       2) fetchPrice_에서 PRICE_HEADERS/SHEET.price 참조 제거
//       3) 행 높이 21px 고정 (작성글+맛집홍보 신규+기존 모두)

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// KAMIS API — 한국농수산식품유통공사
// 키는 스크립트 속성(KAMIS_CERT_KEY, KAMIS_CERT_ID)에서 읽음
const KAMIS_BASE = 'http://www.kamis.or.kr/service/price/xml.do';

// 기존 공공API — 현재 HTTP 500 오류로 비활성
const PRICE_API_KEY  = 'b8ea502c6a13435db5d67932aa833a5d247d74be30c63b319f047b9907b42cdc';
const PRICE_API_BASE = 'https://apis.data.go.kr/B552845/perDay';

const SHEET = {
  posts:   '작성글',
  regions: '지역현황',
  resto:   '맛집홍보'
};

const RESTO_HEADERS  = ['번호','날짜','식당명','위치','채널','제목','콘텐츠','발행상태'];
const POST_HEADERS   = ['번호','날짜','지역(시도)','시/구','업종','콘텐츠타입','핵심키워드','제목','본문(전체)','해시태그','글자수','발행상태'];
const REGION_HEADERS = ['지역','시도','시/구','총글수','발행완료','미발행','주요업종','최종업데이트'];

const ITEM_MAP = {
  '한식': [
    {code:'111',name:'배추',unit:'포기',cat:'채소'},
    {code:'131',name:'양파',unit:'kg',cat:'채소'},
    {code:'121',name:'대파',unit:'kg',cat:'채소'},
    {code:'132',name:'마늘(깐마늘)',unit:'kg',cat:'채소'},
    {code:'221',name:'돼지고기 삼겹살',unit:'100g',cat:'축산'},
    {code:'231',name:'닭고기(생닭)',unit:'kg',cat:'축산'},
    {code:'171',name:'느타리버섯',unit:'kg',cat:'채소'},
    {code:'161',name:'감자',unit:'kg',cat:'채소'}
  ],
  '양식': [
    {code:'154',name:'토마토',unit:'kg',cat:'채소'},
    {code:'155',name:'방울토마토',unit:'kg',cat:'채소'},
    {code:'211',name:'쇠고기 등심',unit:'100g',cat:'축산'},
    {code:'131',name:'양파',unit:'kg',cat:'채소'},
    {code:'434',name:'아보카도',unit:'개',cat:'과일'},
    {code:'172',name:'새송이버섯',unit:'kg',cat:'채소'}
  ],
  '일식': [
    {code:'341',name:'광어(활어)',unit:'kg',cat:'수산'},
    {code:'342',name:'우럭(활어)',unit:'kg',cat:'수산'},
    {code:'311',name:'고등어',unit:'kg',cat:'수산'},
    {code:'321',name:'오징어',unit:'마리',cat:'수산'},
    {code:'332',name:'대하(새우)',unit:'kg',cat:'수산'},
    {code:'173',name:'표고버섯',unit:'kg',cat:'채소'}
  ],
  '중식': [
    {code:'111',name:'배추',unit:'포기',cat:'채소'},
    {code:'131',name:'양파',unit:'kg',cat:'채소'},
    {code:'221',name:'돼지고기 삼겹살',unit:'100g',cat:'축산'},
    {code:'231',name:'닭고기(생닭)',unit:'kg',cat:'축산'},
    {code:'141',name:'고추(풋고추)',unit:'kg',cat:'채소'}
  ],
  '샐러드': [
    {code:'115',name:'상추',unit:'100g',cat:'채소'},
    {code:'114',name:'시금치',unit:'kg',cat:'채소'},
    {code:'155',name:'방울토마토',unit:'kg',cat:'채소'},
    {code:'143',name:'파프리카',unit:'kg',cat:'채소'},
    {code:'434',name:'아보카도',unit:'개',cat:'과일'},
    {code:'421',name:'딸기',unit:'kg',cat:'과일'}
  ],
  '축산': [
    {code:'211',name:'쇠고기 등심(1+등급)',unit:'100g',cat:'축산'},
    {code:'221',name:'돼지고기 삼겹살',unit:'100g',cat:'축산'},
    {code:'231',name:'닭고기(생닭/육계)',unit:'kg',cat:'축산'},
    {code:'232',name:'오리고기',unit:'kg',cat:'축산'}
  ],
  '수산': [
    {code:'311',name:'고등어',unit:'kg',cat:'수산'},
    {code:'341',name:'광어(활어)',unit:'kg',cat:'수산'},
    {code:'342',name:'우럭(활어)',unit:'kg',cat:'수산'},
    {code:'331',name:'꽃게',unit:'kg',cat:'수산'},
    {code:'332',name:'대하(새우)',unit:'kg',cat:'수산'}
  ],
  '공산품': [
    {code:'511',name:'쌀(20kg)',unit:'포',cat:'곡류'},
    {code:'521',name:'밀가루(강력분)',unit:'포',cat:'곡류'},
    {code:'131',name:'양파',unit:'kg',cat:'채소'},
    {code:'221',name:'돼지고기 삼겹살',unit:'100g',cat:'축산'}
  ],
  '주류': [],
  '카페베이커리': []
};

function normalizeIndustry_(ind) {
  var s = (ind||'').toLowerCase().replace(/\//g,'').replace(/\s/g,'');
  if (s.includes('축산'))   return '축산';
  if (s.includes('수산'))   return '수산';
  if (s.includes('한식'))   return '한식';
  if (s.includes('일식'))   return '일식';
  if (s.includes('중식'))   return '중식';
  if (s.includes('양식'))   return '양식';
  if (s.includes('샐러드')) return '샐러드';
  if (s.includes('주류'))   return '주류';
  if (s.includes('카페') || s.includes('베이커리')) return '카페베이커리';
  if (s.includes('공산품')) return '공산품';
  return '한식';
}

/* ══════════════════════════════════════
   라우터
══════════════════════════════════════ */
function doPost(e) {
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    var raw  = (e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(raw);
    if (data.prompt !== undefined)       return out.setContent(JSON.stringify(callClaude_(data)));
    if (data.action === 'fetchPrice')    return out.setContent(JSON.stringify(fetchPrice_(data)));
    if (data.action === 'debugKamis')    return out.setContent(JSON.stringify(debugKamis_(data)));
    if (data.action === 'updateStatus')  return out.setContent(JSON.stringify(updateStatus_(data)));
    if (data.action === 'updatePost')    return out.setContent(JSON.stringify(updatePost_(data)));
    if (data.action === 'saveResto')     return out.setContent(JSON.stringify(saveResto_(data)));
    if (data.action === 'updateResto')   return out.setContent(JSON.stringify(updateResto_(data)));
    if (data.action === 'deleteResto')   return out.setContent(JSON.stringify(deleteResto_(data)));
    if (data.action === 'deletePost')    return out.setContent(JSON.stringify(deletePost_(data)));
    if (data.action === 'fixRowHeights')  return out.setContent(JSON.stringify(fixRowHeights_(data)));
    if (data.action === 'checkRowHeights') return out.setContent(JSON.stringify(checkRowHeights_(data)));
    if (data.action === 'cleanTestData')   return out.setContent(JSON.stringify(cleanTestData_(data)));
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
    success: true, service: 'fnb-blog-writer',
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
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: {'x-api-key': apiKey, 'anthropic-version': '2023-06-01'},
    payload: JSON.stringify({
      model: ANTHROPIC_MODEL, max_tokens: data.max_tokens || 2000,
      messages: [{role: 'user', content: data.prompt}]
    })
  });
  var status = res.getResponseCode();
  var body   = JSON.parse(res.getContentText());
  if (status < 200 || status >= 300)
    throw new Error('Claude API ' + status + ': ' + res.getContentText().substring(0, 100));
  return {success: true, text: (body.content && body.content[0] && body.content[0].text) || ''};
}

/* ══════════════════════════════════════
   단가 조회 — KAMIS API (한국농수산식품유통공사)
   구 B552845 API는 HTTP 500 오류로 KAMIS로 교체
══════════════════════════════════════ */
function debugKamis_(data) {
  var props    = PropertiesService.getScriptProperties();
  var kamisKey = props.getProperty('KAMIS_CERT_KEY') || '';
  var kamisId  = props.getProperty('KAMIS_CERT_ID')  || '';
  if (!kamisKey) return {success:false, message:'KAMIS_CERT_KEY 없음'};

  // p_productclscode 각 값으로 테스트 (02=채소, 04=과일, 06=수산, 07=축산)
  var testCodes = ['01','02','03','04','05','06','07'];
  var results = {};
  var yyyy = new Date().getFullYear() + '';

  testCodes.forEach(function(cls) {
    try {
      var url = KAMIS_BASE
        + '?action=dailySalesList'
        + '&p_cert_key=' + kamisKey
        + '&p_cert_id='  + kamisId
        + '&p_returntype=json'
        + '&p_productclscode=' + cls
        + '&p_yyyy=' + yyyy
        + '&p_period=1'
        + '&p_convert_kg_yn=Y';
      var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
      var d = JSON.parse(res.getContentText());
      var items = (d && d.price) ? d.price : [];
      var cats = {};
      items.forEach(function(it){
        var k = it.category_code + '_' + it.category_name;
        if(!cats[k]) cats[k] = it.item_name;
      });
      results['cls_'+cls] = {
        error_code: d.error_code,
        item_count: items.length,
        categories: cats,
        sample: items[0] ? items[0].item_name + '/' + items[0].dpr1 : '없음'
      };
    } catch(e) {
      results['cls_'+cls] = {error: e.toString()};
    }
    Utilities.sleep(200);
  });

  return {success:true, results:results};
}

function fetchPrice_(params) {
  var industry = params.industry || '한식';
  var key      = normalizeIndustry_(industry);
  var today    = new Date();
  var todayStr = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy-MM-dd');

  // KAMIS category_code 기반 필터
  // 100=식량작물, 200=채소류, 300=특용, 400=과일류, 500=축산물, 600=수산물
  var catMap = {
    '한식':         ['200','500','300'],  // 채소 + 축산 + 특용(깨,마늘)
    '양식':         ['200','500','400'],  // 채소 + 축산 + 과일
    '일식':         ['600','200'],        // 수산 + 채소
    '중식':         ['200','500'],        // 채소 + 축산
    '샐러드':       ['400','200'],        // 과일 + 채소
    '축산':         ['500'],             // 축산
    '수산':         ['600','200'],        // 수산 + 채소
    '공산품':       ['100','200','300'],  // 식량 + 채소 + 특용
    '주류':         ['200','400'],        // 채소 + 과일
    '카페베이커리': ['400','200','100']   // 과일 + 채소 + 식량
  };
  var catCodes = catMap[key] || ['200'];

  var props    = PropertiesService.getScriptProperties();
  var kamisKey = props.getProperty('KAMIS_CERT_KEY') || '';
  var kamisId  = props.getProperty('KAMIS_CERT_ID')  || '';
  if (!kamisKey) {
    return {success:false, industry:key, date:todayStr, prices:[],
      message:'KAMIS_CERT_KEY 스크립트 속성 없음'};
  }

  var yyyy = Utilities.formatDate(today, 'Asia/Seoul', 'yyyy');
  var results = [];

  try {
    // 전체 품목 1회 호출 (p_productclscode 무관하게 동일)
    var url = KAMIS_BASE
      + '?action=dailySalesList'
      + '&p_cert_key=' + kamisKey
      + '&p_cert_id='  + kamisId
      + '&p_returntype=json'
      + '&p_productclscode=01'
      + '&p_yyyy=' + yyyy
      + '&p_period=1'
      + '&p_convert_kg_yn=Y';

    var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
    if (res.getResponseCode() !== 200) {
      return {success:false, industry:key, date:todayStr, prices:[],
        message:'KAMIS HTTP ' + res.getResponseCode()};
    }

    var d = JSON.parse(res.getContentText());
    if (!d || d.error_code !== '000' || !Array.isArray(d.price)) {
      return {success:true, industry:key, date:todayStr, prices:[],
        message:'KAMIS error_code: ' + (d ? d.error_code : 'null')};
    }

    // 업종별 우선 품목 키워드 — 이 키워드가 포함된 품목 우선 표시
    var priorityMap = {
      '한식':      ['양파','대파','마늘','배추','상추','삼겹살','닭','계란'],
      '양식':      ['양파','파프리카','브로콜리','시금치','삼겹살','소'],
      '일식':      ['연어','광어','고등어','오징어','새우','갈치','조기','상추'],
      '중식':      ['대파','마늘','양파','배추','돼지','닭'],
      '샐러드':    ['상추','시금치','파프리카','오이','브로콜리','깻잎','딸기','방울토마토','키위','사과'],
      '축산':      ['삼겹살','목심','갈비','안심','닭','오리','계란'],
      '수산':      ['고등어','갈치','오징어','낙지','새우','명태','조기','김'],
      '공산품':    ['쌀','찹쌀','콩','팥'],
      '주류':      ['배추','양파','마늘'],
      '카페베이커리': ['딸기','바나나','키위','사과','계란']
    };
    var priorities = priorityMap[key] || [];

    // category_code로 업종별 필터 + 우선 품목 정렬
    catCodes.forEach(function(cat) {
      var catItems = d.price.filter(function(it) {
        return it.category_code === cat
          && it.dpr1 && it.dpr1 !== '-' && it.dpr1 !== '0';
      });

      // 우선 품목 먼저, 나머지 뒤에
      catItems.sort(function(a, b) {
        var aName = (a.item_name || '');
        var bName = (b.item_name || '');
        var aPri = priorities.some(function(p){ return aName.includes(p); }) ? 0 : 1;
        var bPri = priorities.some(function(p){ return bName.includes(p); }) ? 0 : 1;
        return aPri - bPri;
      });

      catItems.slice(0, 5).forEach(function(it) {
        var dir = it.direction === '1' ? '▲' : it.direction === '2' ? '▼' : '-';
        results.push({
          name:      it.item_name || it.productName || '',
          unit:      it.unit || 'kg',
          wholesale: it.dpr1 || '-',
          retail:    it.dpr2 || '-',
          trend:     dir,
          date:      todayStr
        });
      });
    });

  } catch(e) {
    Logger.log('KAMIS 오류: ' + e);
    return {success:false, industry:key, date:todayStr, prices:[], message:e.toString()};
  }

  return {
    success: true,
    industry: key,
    date: todayStr,
    prices: results,
    summary: results.slice(0, 3).map(function(p) {
      return p.name + ': ' + p.wholesale + '원/' + p.unit;
    }).join(' | ')
  };
}

/* ══════════════════════════════════════
   글 저장 — 행 높이 21px 고정
══════════════════════════════════════ */
function savePost_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var region = data.region || '';
  var sido   = data.sido  || region.split(' ')[0] || '';
  var gugun  = data.gugun || region.split(' ').slice(1).join(' ') || '';
  var rowNum = sheet.getLastRow();
  sheet.appendRow([
    rowNum,
    data.date || new Date().toLocaleDateString('ko-KR'),
    sido, gugun,
    data.industry || '', data.type || '',
    data.keyword || data.kw || '', data.title || '',
    String(data.body || ''),
    data.hashtags || '', Number(data.chars) || 0, '미발행'
  ]);
  SpreadsheetApp.flush();
  var newRow = sheet.getLastRow();
  if (newRow % 2 === 0) sheet.getRange(newRow, 1, 1, POST_HEADERS.length).setBackground('#F8FAFC');
  sheet.getRange(newRow, 12).setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
  updateRegion_(ss, sido + (gugun ? ' ' + gugun : ''), data.industry);
  return {success: true, row: newRow};
}

function updatePost_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (data.rowId) {
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r,1).getValue() == data.rowId) { targetRow = r; break; }
    }
  }
  if (targetRow === -1 && data.oldTitle) {
    for (var r2 = 2; r2 <= lastRow; r2++) {
      if (sheet.getRange(r2,8).getValue() === data.oldTitle) { targetRow = r2; break; }
    }
  }
  if (targetRow === -1) return {success: false, message: '해당 글을 찾을 수 없습니다'};
  if (data.title    !== undefined) sheet.getRange(targetRow, 8).setValue(data.title);
  if (data.body     !== undefined) sheet.getRange(targetRow, 9).setValue(data.body);
  if (data.hashtags !== undefined) sheet.getRange(targetRow, 10).setValue(data.hashtags);
  if (data.status   !== undefined) {
    var cell = sheet.getRange(targetRow, 12);
    cell.setValue(data.status);
    if (data.status === '발행완료') cell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
    else cell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
  }
  return {success: true, row: targetRow};
}

/* ══════════════════════════════════════
   기존 행 높이 일괄 21px 고정 (웹에서 호출)
══════════════════════════════════════ */
/* 테스트 데이터 삭제 */
function cleanTestData_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var testKeywords = ['테스트','진단','행높이','검증','21px','WrapClip','높이'];
  var deleted = 0;

  // 작성글 탭 정리
  var postSheet = ss.getSheetByName(SHEET.posts);
  if (postSheet) {
    for (var r = postSheet.getLastRow(); r >= 2; r--) {
      var kw = String(postSheet.getRange(r, 7).getValue());
      var title = String(postSheet.getRange(r, 8).getValue());
      var combined = kw + title;
      var isTest = testKeywords.some(function(t){ return combined.includes(t); });
      if (isTest) { postSheet.deleteRow(r); deleted++; }
    }
  }

  // 지역현황 탭 정리
  var regSheet = ss.getSheetByName(SHEET.regions);
  if (regSheet) {
    for (var r2 = regSheet.getLastRow(); r2 >= 2; r2--) {
      var reg = String(regSheet.getRange(r2, 1).getValue());
      var isTest2 = testKeywords.some(function(t){ return reg.includes(t); });
      if (isTest2) { regSheet.deleteRow(r2); deleted++; }
    }
  }

  SpreadsheetApp.flush();
  return {success: true, deleted: deleted, message: deleted + '개 테스트 행 삭제 완료'};
}


function checkRowHeights_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ss.getSheetByName(SHEET.posts);
  if (!sheet) return {success:false, message:'시트 없음'};
  var lastRow = sheet.getLastRow();
  var samples = [];
  // 마지막 5개 행의 실제 높이 체크
  var start = Math.max(2, lastRow - 4);
  for (var r = start; r <= lastRow; r++) {
    samples.push({row: r, height: sheet.getRowHeight(r)});
  }
  return {success: true, lastRow: lastRow, samples: samples};
}


function fixRowHeights_(data) {
  var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var fixed = 0;

  // 작성글 탭 — 행 높이만 21px로 일괄 고정 (본문 내용 보존)
  var postSheet = ss.getSheetByName(SHEET.posts);
  if (postSheet) {
    var lastRow = postSheet.getLastRow();
    if (lastRow > 1) {
      for (var r = 2; r <= lastRow; r++) {
        postSheet.setRowHeight(r, 21);
        fixed++;
      }
      SpreadsheetApp.flush();
    }
  }

  // 맛집홍보 탭 — CLIP 적용 + 21px 고정
  var restoSheet = ss.getSheetByName(SHEET.resto);
  if (restoSheet) {
    var restoLast = restoSheet.getLastRow();
    if (restoLast > 1) {
      restoSheet.getRange(2, 7, restoLast - 1, 1)
                .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
      for (var r2 = 2; r2 <= restoLast; r2++) {
        restoSheet.setRowHeight(r2, 21);
        fixed++;
      }
      SpreadsheetApp.flush();
    }
  }

  return {success: true, fixed: fixed, message: fixed + '개 행을 21px로 고정했습니다'};
}


function deletePost_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (data.rowId) {
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r,1).getValue() == data.rowId) { targetRow = r; break; }
    }
  }
  if (targetRow === -1 && data.title) {
    for (var r2 = 2; r2 <= lastRow; r2++) {
      if (sheet.getRange(r2,8).getValue() === data.title) { targetRow = r2; break; }
    }
  }
  if (targetRow === -1) return {success: false, message: '해당 글을 찾을 수 없습니다'};
  sheet.deleteRow(targetRow);
  return {success: true, deleted: true, row: targetRow};
}

function updateStatus_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r, 8).getValue() === data.title) {
      var cell   = sheet.getRange(r, 12);
      var status = data.uploadStatus || '미발행';
      cell.setValue(status);
      if (status === '발행완료') cell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      else cell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
      updateRegionPublish_(ss, r, status);
      return {success: true, updated: true, row: r};
    }
  }
  return {success: true, updated: false};
}

/* ══════════════════════════════════════
   맛집홍보 저장/수정/삭제 — 행 높이 21px 고정
══════════════════════════════════════ */
function saveResto_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var rowNum = sheet.getLastRow();
  sheet.appendRow([
    rowNum,
    data.date     || new Date().toLocaleDateString('ko-KR'),
    data.restName || '', data.location || '', data.channel || '',
    data.title    || (data.restName + ' ' + data.channel),
    String(data.content || ''), '미발행'
  ]);
  SpreadsheetApp.flush();
  var newRow = sheet.getLastRow();
  if (newRow % 2 === 0) sheet.getRange(newRow, 1, 1, RESTO_HEADERS.length).setBackground('#F8FAFC');
  sheet.getRange(newRow, 8).setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
  sheet.getRange(newRow, 7).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sheet.setRowHeight(newRow, 21);
  SpreadsheetApp.flush();
  return {success: true, row: newRow, rowHeight: 21};
}

function updateResto_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r,1).getValue() == data.rowId ||
        sheet.getRange(r,6).getValue() === data.oldTitle) { targetRow = r; break; }
  }
  if (targetRow === -1) return {success: false, message: '찾을 수 없음'};
  if (data.title   !== undefined) sheet.getRange(targetRow, 6).setValue(data.title);
  if (data.content !== undefined) sheet.getRange(targetRow, 7).setValue(data.content);
  if (data.status  !== undefined) {
    var c = sheet.getRange(targetRow, 8);
    c.setValue(data.status);
    c.setBackground(data.status === '발행완료' ? '#DCFCE7' : '#FEF3C7')
     .setFontColor(data.status === '발행완료' ? '#166534' : '#92400E').setFontWeight('bold');
  }
  return {success: true, row: targetRow};
}

function deleteResto_(data) {
  var ss    = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  var sheet = ensureSheet_(ss, SHEET.resto, RESTO_HEADERS);
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    if (sheet.getRange(r,1).getValue() == data.rowId ||
        sheet.getRange(r,6).getValue() === data.title) {
      sheet.deleteRow(r);
      return {success: true, deleted: true};
    }
  }
  return {success: false, message: '찾을 수 없음'};
}

/* ══════════════════════════════════════
   지역현황
══════════════════════════════════════ */
function updateRegion_(ss, region, industry) {
  if (!region.trim()) return;
  try {
    var sheet   = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    var parts   = region.split(' ');
    var today   = new Date().toLocaleDateString('ko-KR');
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r,1).getValue() === region) {
        sheet.getRange(r,4).setValue(parseInt(sheet.getRange(r,4).getValue()||0) + 1);
        sheet.getRange(r,6).setValue(parseInt(sheet.getRange(r,6).getValue()||0) + 1);
        sheet.getRange(r,8).setValue(today);
        return;
      }
    }
    sheet.appendRow([region, parts[0]||'', parts.slice(1).join(' ')||'', 1, 0, 1, industry||'', today]);
  } catch(e) { Logger.log('지역현황 오류: ' + e); }
}

function updateRegionPublish_(ss, postRow, status) {
  try {
    var postSheet = ensureSheet_(ss, SHEET.posts, POST_HEADERS);
    var sido      = postSheet.getRange(postRow, 3).getValue();
    var gugun     = postSheet.getRange(postRow, 4).getValue();
    var region    = sido + (gugun ? ' ' + gugun : '');
    if (!region.trim()) return;
    var regSheet = ensureSheet_(ss, SHEET.regions, REGION_HEADERS);
    var lastRow  = regSheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (regSheet.getRange(r,1).getValue() === region) {
        var done    = parseInt(regSheet.getRange(r,5).getValue()||0);
        var pending = parseInt(regSheet.getRange(r,6).getValue()||0);
        if (status === '발행완료') {
          regSheet.getRange(r,5).setValue(done + 1);
          regSheet.getRange(r,6).setValue(Math.max(0, pending - 1));
        } else {
          regSheet.getRange(r,5).setValue(Math.max(0, done - 1));
          regSheet.getRange(r,6).setValue(pending + 1);
        }
        break;
      }
    }
  } catch(e) { Logger.log('발행현황 업데이트 오류: ' + e); }
}

/* ══════════════════════════════════════
   시트 정비 — 수동 1회 실행
   ★ 핵심 수정: keepSheets에 '맛집홍보' 포함
   ★ 기존 행 전부 21px 고정 (작성글 + 맛집홍보)
══════════════════════════════════════ */
function cleanupSheets() {
  var ss = SpreadsheetApp.openById(getSheetId_());

  // ★★★ '맛집홍보' 반드시 포함 — 빠지면 실행 시 탭 삭제됨 ★★★
  var keepSheets = ['작성글', '지역현황', '맛집홍보'];
  var sheets = ss.getSheets();

  // 1. 불필요한 탭 삭제
  sheets.forEach(function(sheet) {
    if (keepSheets.indexOf(sheet.getName()) === -1 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
      Logger.log('삭제: ' + sheet.getName());
    }
  });

  // 2. 작성글 헤더 강제 재설정
  var postSheet = ss.getSheetByName('작성글') || ss.insertSheet('작성글');
  var ph = ['번호','날짜','지역(시도)','시/구','업종','콘텐츠타입',
            '핵심키워드','제목','본문(전체)','해시태그','글자수','발행상태'];
  postSheet.getRange(1,1,1,ph.length).setValues([ph]);
  postSheet.getRange(1,1,1,ph.length)
    .setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  postSheet.setFrozenRows(1);

  // 3. 빈 행 삭제
  var lastRow = postSheet.getLastRow();
  var toDelete = [];
  for (var r = lastRow; r >= 2; r--) {
    if (!postSheet.getRange(r,8).getValue() && !postSheet.getRange(r,11).getValue()) {
      toDelete.push(r);
    }
  }
  toDelete.sort(function(a,b){return b-a;});
  toDelete.forEach(function(r){postSheet.deleteRow(r);});
  Logger.log('빈 행 ' + toDelete.length + '개 삭제');

  // 4. 발행상태 열 스타일 정비
  var finalRow = postSheet.getLastRow();
  if (finalRow > 1) {
    for (var r2 = 2; r2 <= finalRow; r2++) {
      var sc = postSheet.getRange(r2, 12);
      var sv = sc.getValue();
      if (!sv || sv === '자동생성' || sv === '미발행') {
        sc.setValue('미발행').setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('bold');
      } else if (sv === '발행완료') {
        sc.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
      }
    }
  }

  // 5. 지역현황 + 맛집홍보 탭 보장
  var regSheet   = ensureSheet_(ss, '지역현황', REGION_HEADERS);
  var restoSheet = ensureSheet_(ss, '맛집홍보',  RESTO_HEADERS);
  restoSheet.setColumnWidth(7, 500);
  restoSheet.setColumnWidth(6, 300);

  // 6. 헤더 스타일 재적용
  [postSheet, regSheet, restoSheet].forEach(function(sh) {
    sh.getRange(1,1,1,sh.getLastColumn())
      .setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  });

  // 7. ★ 작성글 기존 행 전부 21px 고정 + 줄바꿈 해제
  var postLastRow = postSheet.getLastRow();
  if (postLastRow > 1) {
    postSheet.getRange(2, 9, postLastRow - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    for (var pr = 2; pr <= postLastRow; pr++) {
      postSheet.setRowHeight(pr, 21);
    }
    Logger.log('작성글 ' + (postLastRow - 1) + '행 → 21px 고정');
  }

  // 8. ★ 맛집홍보 기존 행 전부 21px 고정 + 줄바꿈 해제
  var restoLastRow = restoSheet.getLastRow();
  if (restoLastRow > 1) {
    restoSheet.getRange(2, 7, restoLastRow - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    for (var rr = 2; rr <= restoLastRow; rr++) {
      restoSheet.setRowHeight(rr, 21);
    }
    Logger.log('맛집홍보 ' + (restoLastRow - 1) + '행 → 21px 고정');
  }

  Logger.log('✅ 시트 정비 완료 (v5)');
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
    var h = sheet.getRange(1,1,1,headers.length);
    h.setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    if (name === SHEET.resto) {
      sheet.setColumnWidth(1,50); sheet.setColumnWidth(3,120); sheet.setColumnWidth(4,150);
      sheet.setColumnWidth(5,80); sheet.setColumnWidth(6,280); sheet.setColumnWidth(7,500); sheet.setColumnWidth(8,80);
    }
    if (name === SHEET.posts) {
      sheet.setColumnWidth(1,50);  sheet.setColumnWidth(2,90);  sheet.setColumnWidth(3,70);
      sheet.setColumnWidth(4,70);  sheet.setColumnWidth(5,90);  sheet.setColumnWidth(6,90);
      sheet.setColumnWidth(7,200); sheet.setColumnWidth(8,320); sheet.setColumnWidth(9,500);
      sheet.setColumnWidth(10,220);sheet.setColumnWidth(11,60); sheet.setColumnWidth(12,80);
    }
  } else if (sheet.getRange(1,1).getValue() === '') {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length)
      .setBackground('#0F172A').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}

function setupWeeklyTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();
  ScriptApp.newTrigger('weeklyAutoWrite').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(9).create();
  Logger.log('트리거 설정 완료: 매주 화/금 오전 9시');
}
