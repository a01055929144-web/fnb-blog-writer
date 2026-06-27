// F&B Lead Engine — Google Sheets 자동 저장 + 상태 업데이트
const SHEET_ID = '1l0eaRkz-XmA5QpjT4LN5c1q5kdbZqKBRS6iAu8TpHBU';
const HEADERS = ['번호','날짜','지역','키워드','업종','콘텐츠타입','제목','본문(500자)','해시태그','글자수','저장상태','블로그업로드'];

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(data.sheetId || SHEET_ID);
    const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];

    // 헤더 없으면 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      const hRange = sheet.getRange(1, 1, 1, HEADERS.length);
      hRange.setBackground('#0F172A');
      hRange.setFontColor('#FFFFFF');
      hRange.setFontWeight('bold');
      hRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 50);   // 번호
      sheet.setColumnWidth(2, 90);   // 날짜
      sheet.setColumnWidth(3, 110);  // 지역
      sheet.setColumnWidth(4, 200);  // 키워드
      sheet.setColumnWidth(5, 90);   // 업종
      sheet.setColumnWidth(6, 100);  // 콘텐츠타입
      sheet.setColumnWidth(7, 300);  // 제목
      sheet.setColumnWidth(8, 400);  // 본문
      sheet.setColumnWidth(9, 280);  // 해시태그
      sheet.setColumnWidth(10, 70);  // 글자수
      sheet.setColumnWidth(11, 80);  // 저장상태
      sheet.setColumnWidth(12, 100); // 블로그업로드
    }

    // 상태 업데이트 요청인지 확인
    if (data.action === 'updateStatus') {
      const lastRow = sheet.getLastRow();
      for (let r = 2; r <= lastRow; r++) {
        const cellTitle = sheet.getRange(r, 7).getValue();
        const cellKeyword = sheet.getRange(r, 4).getValue();
        if (cellTitle === data.title || cellKeyword === data.keyword) {
          const statusCell = sheet.getRange(r, 12); // 블로그업로드 컬럼
          const newStatus = data.uploadStatus || '미발행';
          statusCell.setValue(newStatus);
          // 발행완료면 초록, 미발행이면 노란색
          if (newStatus === '발행완료') {
            statusCell.setBackground('#DCFCE7').setFontColor('#166534').setFontWeight('bold');
          } else {
            statusCell.setBackground('#FEF3C7').setFontColor('#92400E').setFontWeight('normal');
          }
          output.setContent(JSON.stringify({ success: true, updated: true, row: r }));
          return output;
        }
      }
      output.setContent(JSON.stringify({ success: true, updated: false, message: '해당 글을 찾지 못했어요' }));
      return output;
    }

    // 새 글 저장
    const rowNum = sheet.getLastRow(); // 헤더 제외 번호
    const row = [
      rowNum,
      data.date || new Date().toLocaleDateString('ko-KR'),
      data.region || '',
      data.keyword || '',
      data.industry || '',
      data.type || '',
      data.title || '',
      String(data.body || '').substring(0, 500),
      data.hashtags || '',
      data.chars || 0,
      data.status || '자동생성',
      '미발행' // 블로그업로드 초기값
    ];
    sheet.appendRow(row);

    // 새 행 스타일
    const newRow = sheet.getLastRow();
    const rowRange = sheet.getRange(newRow, 1, 1, HEADERS.length);
    if (newRow % 2 === 0) rowRange.setBackground('#F8FAFC');

    // 블로그업로드 컬럼 기본 스타일 (노란색)
    sheet.getRange(newRow, 12).setBackground('#FEF3C7').setFontColor('#92400E');

    output.setContent(JSON.stringify({ success: true, row: newRow }));
    return output;

  } catch (err) {
    output.setContent(JSON.stringify({ success: false, message: err.toString() }));
    return output;
  }
}

function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify({ status: 'ok', message: 'F&B Lead Engine API 정상 작동 중', time: new Date().toISOString() }));
  return output;
}
