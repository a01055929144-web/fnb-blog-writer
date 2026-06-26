// F&B 블로그 작성기 Web App
// - prompt 요청: Claude API 호출 후 { success, text } 반환
// - saveState 요청: 앱의 각 탭 데이터를 Google Sheets 탭으로 저장
// - row 요청: 작성글 탭에 자동 저장
//
// Script Properties에 아래 값을 설정하세요.
// ANTHROPIC_API_KEY = Claude API 키
// SHEET_ID = Google Sheet ID (선택, 없으면 아래 기본값 사용)

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const SHEETS = {
  projects: '프로젝트',
  keywords: '키워드',
  clusters: '토픽클러스터',
  posts: '작성글',
  cta: 'CTA',
  memo: '설정메모',
  state: '앱상태',
};

const HEADERS = {
  projects: ['저장일시', '프로젝트ID', '프로젝트명', '업종', '지역', '목표글수', '완료글수', '생성일'],
  keywords: ['저장일시', '업종', '지역', '품목', '키워드', '검색의도', '난이도', '선택여부', '설명'],
  clusters: ['저장일시', '키워드', '제목', '검색의도', '선택여부'],
  posts: ['날짜', '지역', '키워드', '업종', '콘텐츠타입', '제목', '본문요약', '해시태그', '글자수', '상태'],
  cta: ['저장일시', '전화번호', '일반데이터', '지역데이터'],
  memo: ['저장일시', '페이지', '메모'],
  state: ['저장일시', '상태JSON'],
};

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (data.prompt) return json_(callClaude_(data));
    if (data.action === 'bootstrapSheets') return json_(bootstrapSheets_());
    if (data.action === 'saveState') return json_(saveState_(data.state || {}));
    if (data.action === 'loadState') return json_(loadState_());
    return json_(appendSheetRow_(data));
  } catch (err) {
    return json_({ success: false, message: err.message || String(err) });
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'bootstrapSheets') return json_(bootstrapSheets_());
  if (action === 'loadState') return json_(loadState_());

  const props = PropertiesService.getScriptProperties();
  bootstrapSheets_();
  return json_({
    success: true,
    service: 'fnb-blog-writer',
    message: 'F&B 블로그 작성기 API 작동 중',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!getSheetId_(),
    sheets: Object.keys(SHEETS).map(function(key) { return SHEETS[key]; }),
  });
}

function authorizeOnce() {
  PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  bootstrapSheets_();
  UrlFetchApp.fetch('https://api.anthropic.com', {
    method: 'get',
    muteHttpExceptions: true,
  });
}

function callClaude_(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Script Properties에 ANTHROPIC_API_KEY가 없습니다.');

  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: data.model || ANTHROPIC_MODEL,
      max_tokens: data.max_tokens || 1000,
      messages: [{ role: 'user', content: data.prompt }],
    }),
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('Anthropic API 오류 ' + status + ': ' + text);
  }

  const body = JSON.parse(text);
  return {
    success: true,
    text: (body.content && body.content[0] && body.content[0].text) || '',
  };
}

function appendSheetRow_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ensureSheet_(ss, SHEETS.posts, HEADERS.posts);

  const body = data.body || '';
  const bodyPreview = body.substring(0, 300) + (body.length > 300 ? '...' : '');
  const row = [
    data.date || new Date().toLocaleDateString('ko-KR'),
    data.region || '',
    data.keyword || '',
    data.industry || '',
    data.type || '',
    data.title || '',
    bodyPreview,
    data.hashtags || '',
    data.chars || 0,
    data.status || '작성완료',
  ];

  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, HEADERS.posts.length).setBackground('#F8FAFC');
  }
  setColumnWidths_(sheet, [100, 120, 180, 100, 120, 300, 400, 300, 70, 80]);

  return { success: true, row: lastRow };
}

function bootstrapSheets_() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  Object.keys(SHEETS).forEach(function(key) {
    ensureSheet_(ss, SHEETS[key], HEADERS[key]);
  });
  return { success: true, sheets: Object.keys(SHEETS).map(function(key) { return SHEETS[key]; }) };
}

function saveState_(state) {
  const ss = SpreadsheetApp.openById(getSheetId_());
  const savedAt = new Date();
  bootstrapSheets_();

  const projectRows = projectRows_(state, savedAt);
  const keywordRows = keywordRows_(state, savedAt);
  const clusterRows = clusterRows_(state, savedAt);
  if (projectRows.length) {
    replaceRows_(ensureSheet_(ss, SHEETS.projects, HEADERS.projects), HEADERS.projects, projectRows);
  }
  if (keywordRows.length) {
    replaceRows_(ensureSheet_(ss, SHEETS.keywords, HEADERS.keywords), HEADERS.keywords, keywordRows);
  }
  if (clusterRows.length) {
    replaceRows_(ensureSheet_(ss, SHEETS.clusters, HEADERS.clusters), HEADERS.clusters, clusterRows);
  }
  const postRows = postRows_(state);
  if (postRows.length) {
    replaceRows_(ensureSheet_(ss, SHEETS.posts, HEADERS.posts), HEADERS.posts, postRows);
  } else {
    ensureSheet_(ss, SHEETS.posts, HEADERS.posts);
  }
  replaceRows_(ensureSheet_(ss, SHEETS.cta, HEADERS.cta), HEADERS.cta, ctaRows_(state, savedAt));
  replaceRows_(ensureSheet_(ss, SHEETS.memo, HEADERS.memo), HEADERS.memo, memoRows_(state, savedAt));
  replaceRows_(ensureSheet_(ss, SHEETS.state, HEADERS.state), HEADERS.state, [[savedAt, JSON.stringify(state)]]);

  return { success: true, savedAt: savedAt.toISOString() };
}

function loadState_() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  const sheet = ensureSheet_(ss, SHEETS.state, HEADERS.state);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, state: null };
  const json = sheet.getRange(lastRow, 2).getValue();
  return { success: true, state: json ? JSON.parse(json) : null };
}

function projectRows_(state, savedAt) {
  return (state.projects || []).map(function(p) {
    return [
      savedAt,
      p.id || '',
      p.name || '',
      p.industry || '',
      (p.regions || []).join(', '),
      p.goal || 0,
      p.done || 0,
      p.created || '',
    ];
  });
}

function keywordRows_(state, savedAt) {
  const keyword = state.keyword || {};
  const selected = keyword.selectedKeywords || [];
  return (keyword.kwData || []).map(function(k) {
    return [
      savedAt,
      keyword.industry || '',
      k.region || '',
      (keyword.selectedItems || []).join(', '),
      k.keyword || '',
      k.intent || '',
      k.difficulty || '',
      selected.some(function(item) { return (item.kw || item.keyword || item) === k.keyword; }) ? 'Y' : '',
      k.why || '',
    ];
  });
}

function clusterRows_(state, savedAt) {
  const cluster = state.cluster || {};
  const selected = cluster.selectedClusters || [];
  return (cluster.clusterData || []).map(function(c, i) {
    return [
      savedAt,
      c.keyword || '',
      c.title || '',
      c.intent || '',
      selected.includes(i) || selected.includes(c.title) ? 'Y' : '',
    ];
  });
}

function postRows_(state) {
  const writer = state.writer || {};
  return (writer.history || []).map(function(h) {
    const body = h.body || '';
    return [
      h.date || '',
      h.region || '',
      h.kw || h.keyword || '',
      h.industry || '',
      h.type || '',
      h.title || '',
      body.substring(0, 300) + (body.length > 300 ? '...' : ''),
      (h.tags || []).join(' '),
      h.chars || 0,
      h.status || '작성완료',
    ];
  });
}

function ctaRows_(state, savedAt) {
  const cta = state.cta || {};
  return [[
    savedAt,
    cta.phone || '',
    cta.useGeneral ? 'ON' : 'OFF',
    cta.useLocal ? 'ON' : 'OFF',
  ]];
}

function memoRows_(state, savedAt) {
  const keyword = state.keyword || {};
  return [[savedAt, 'Keyword Engine', keyword.guideMemo || '']];
}

function replaceRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet, headers.length);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    styleHeader_(sheet, headers.length);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function styleHeader_(sheet, length) {
  const headerRange = sheet.getRange(1, 1, 1, length);
  headerRange.setBackground('#0F172A');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
}

function setColumnWidths_(sheet, widths) {
  widths.forEach(function(width, i) {
    sheet.setColumnWidth(i + 1, width);
  });
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
