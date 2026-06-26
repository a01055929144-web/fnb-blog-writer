// F&B 블로그 작성기 Web App
// - prompt 요청: Claude API 호출 후 { success, text } 반환
// - row 요청: Google Sheets에 자동 저장
//
// Script Properties에 아래 값을 설정하세요.
// ANTHROPIC_API_KEY = Claude API 키
// SHEET_ID = Google Sheet ID (선택, 없으면 아래 기본값 사용)

const DEFAULT_SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const SHEET_NAME = 'Sheet1';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const HEADERS = [
  '날짜', '지역', '키워드', '업종', '콘텐츠타입',
  '제목', '본문요약', '해시태그', '글자수', '상태'
];

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (data.prompt) return json_(callClaude_(data));
    return json_(appendSheetRow_(data));
  } catch (err) {
    return json_({ success: false, message: err.message || String(err) });
  }
}

function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({
    success: true,
    service: 'fnb-blog-writer',
    message: 'F&B 블로그 작성기 API 작동 중',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!getSheetId_(),
  });
}

function authorizeOnce() {
  PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  SpreadsheetApp.openById(getSheetId_());
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
    throw new Error(`Anthropic API 오류 ${status}: ${text}`);
  }

  const body = JSON.parse(text);
  return {
    success: true,
    text: (body.content && body.content[0] && body.content[0].text) || '',
  };
}

function appendSheetRow_(data) {
  const ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  ensureHeader_(sheet);

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
    sheet.getRange(lastRow, 1, 1, HEADERS.length).setBackground('#F8FAFC');
  }
  if (lastRow <= 2) setColumnWidths_(sheet);

  return { success: true, row: lastRow };
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(HEADERS);
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#0F172A');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function setColumnWidths_(sheet) {
  [100, 120, 180, 100, 120, 300, 400, 300, 70, 80]
    .forEach((width, i) => sheet.setColumnWidth(i + 1, width));
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
