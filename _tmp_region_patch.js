
/* 허용 지역 설정 저장/조회 — 새 시트 '지역설정' 사용 */
function saveRegionConfig_(data){
  try{
    var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
    var sheet = ss.getSheetByName('지역설정') || ss.insertSheet('지역설정');
    sheet.clear();
    sheet.appendRow(['지역']);
    (data.list||[]).forEach(function(r){
      sheet.appendRow([r]);
    });
    return {success:true, count:(data.list||[]).length};
  }catch(e){
    return {success:false, message:e.message};
  }
}

function getRegionConfig_(data){
  try{
    var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
    var sheet = ss.getSheetByName('지역설정');
    if(!sheet || sheet.getLastRow() < 2) return {success:true, list:[]};
    var rows = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
    var list = rows.map(function(r){ return r[0]; }).filter(Boolean);
    return {success:true, list:list};
  }catch(e){
    return {success:false, message:e.message};
  }
}

/* 매일 랜덤으로 지역+업종 선택 — '지역설정' 시트에 등록된 게 있으면 그 안에서, 없으면 기본값(AREA_DATA_SRV)에서 */
function pickRandomRegionIndustry_(){
  var industry = INDUSTRIES_SRV[Math.floor(Math.random()*INDUSTRIES_SRV.length)];

  var cfg = getRegionConfig_({sheetId: getSheetId_()});
  if(cfg.success && cfg.list && cfg.list.length){
    var region = cfg.list[Math.floor(Math.random()*cfg.list.length)];
    return { region: region, industry: industry };
  }

  var sidos = Object.keys(AREA_DATA_SRV);
  var sido = sidos[Math.floor(Math.random()*sidos.length)];
  var districts = AREA_DATA_SRV[sido];
  var district = districts[Math.floor(Math.random()*districts.length)];
  return { region: sido+' '+district, industry: industry };
}
