const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({
    success: true,
    service: 'fnb-blog-writer',
    hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
    hasSheetId: !!props.getProperty('SHEET_ID'),
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.prompt) return json_(callClaude_(body));
    return json_(appendSheetRow_(body));
  } catch (err) {
    return json_({ success: false, message: err.message || String(err) });
  }
}

function callClaude_(body) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Script property ANTHROPIC_API_KEY is missing');

  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: body.model || ANTHROPIC_MODEL,
      max_tokens: body.max_tokens || 1000,
      messages: [{ role: 'user', content: body.prompt }],
    }),
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Anthropic API error ${status}: ${text}`);
  }

  const data = JSON.parse(text);
  return { success: true, text: (data.content && data.content[0] && data.content[0].text) || '' };
}

function appendSheetRow_(body) {
  const sheetId = body.sheetId || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('sheetId or Script property SHEET_ID is missing');

  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheets()[0];
  sheet.appendRow([
    body.date || new Date(),
    body.region || '',
    body.keyword || '',
    body.industry || '',
    body.type || '',
    body.title || '',
    body.body || '',
    body.hashtags || '',
    body.chars || '',
    body.status || '',
  ]);

  return { success: true };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
