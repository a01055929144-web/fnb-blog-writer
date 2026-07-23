const AREA_DATA_SRV = {
  "서울": ["종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구","강북구","도봉구","노원구","은평구","서대문구","마포구","양천구","강서구","구로구","금천구","영등포구","동작구","관악구","서초구","강남구","송파구","강동구"],
  "경기": ["수원시 장안구","수원시 권선구","수원시 팔달구","수원시 영통구","성남시 수정구","성남시 중원구","성남시 분당구","고양시 덕양구","고양시 일산동구","고양시 일산서구","용인시 처인구","용인시 기흥구","용인시 수지구","안양시 만안구","안양시 동안구","안산시 단원구","안산시 상록구","부천시","남양주시","화성시","평택시","의정부시","시흥시","파주시","김포시","광명시","광주시","군포시","하남시","오산시","이천시","안성시","의왕시","양주시","구리시","포천시","동두천시","과천시"],
  "인천": ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군"],
  "부산": ["해운대구","수영구","남구","부산진구","기장군","동래구","사하구","강서구","연제구","금정구"],
  "대구": ["중구","수성구","달서구","북구","동구","남구","서구","달성군"],
  "대전": ["유성구","서구","중구","대덕구","동구"],
  "광주": ["동구","서구","남구","북구","광산구"],
  "울산": ["남구","중구","북구","동구","울주군"],
};
const INDUSTRIES_SRV = ["한식","양식","일식","중식","샐러드","주류","축산","수산","카페베이커리","공산품"];
/* 매일 랜덤으로 지역+업종 선택 (등록 목록 대신 전체 풀에서) */
function pickRandomRegionIndustry_(){
  var sidos = Object.keys(AREA_DATA_SRV);
  var sido = sidos[Math.floor(Math.random()*sidos.length)];
  var districts = AREA_DATA_SRV[sido];
  var district = districts[Math.floor(Math.random()*districts.length)];
  var industry = INDUSTRIES_SRV[Math.floor(Math.random()*INDUSTRIES_SRV.length)];
  return { region: sido+' '+district, industry: industry };
}

function dailyAutoWrite(){
  var picked = pickRandomRegionIndustry_();
  var region = picked.region, industry = picked.industry;

  var priceData = fetchPrice_({industry: industry, sheetId: getSheetId_()});
  var priceStats = getPriceStats_({industry: industry, period:'weekly', sheetId: getSheetId_()});
  var existingPosts = loadExistingPostsSrv_();

  var mailResults = [];

  try{
    var issue = detectDailyIssueSrv_(region, industry, priceData, priceStats);
    if(isDuplicatePostSrv_(region, industry, issue.kw, existingPosts)){
      mailResults.push({ok:false, title:issue.kw+' (중복이라 건너뜀)', kind:'오늘의 이슈'});
      Logger.log('중복으로 건너뜀: ' + issue.kw);
    } else {
      var r1 = writeAndSaveOnePostSrv_(issue.kw, region, industry, issue.type, priceData, priceStats, '업체찾기');
      mailResults.push({ok:r1.success, title:(r1.title||issue.kw), kind:'오늘의 이슈'});
      existingPosts.push({region:region, industry:industry, kw:issue.kw, title:r1.title||issue.kw});
      Logger.log('완료: ' + issue.kw);
    }
  }catch(e){ mailResults.push({ok:false, title:e.message, kind:'오늘의 이슈'}); Logger.log('실패: ' + e.message); }

  try{
    var gen = null;
    for(var attempt=0; attempt<3; attempt++){
      var cand = generateGeneralKeywordSrv_(region, industry);
      if(!isDuplicatePostSrv_(region, industry, cand.kw, existingPosts)){ gen = cand; break; }
      Logger.log('일반글 후보 중복, 재시도: ' + cand.kw);
    }
    if(!gen){
      mailResults.push({ok:false, title:'적합한 키워드를 못 찾아 건너뜀', kind:'일반 키워드'});
    } else {
      var r2 = writeAndSaveOnePostSrv_(gen.kw, region, industry, '가이드', priceData, priceStats, gen.intent);
      mailResults.push({ok:r2.success, title:(r2.title||gen.kw), kind:'일반 키워드'});
      Logger.log('완료: ' + gen.kw);
    }
  }catch(e){ mailResults.push({ok:false, title:e.message, kind:'일반 키워드'}); Logger.log('실패: ' + e.message); }

  try{ sendDailyWriteEmail_(region, industry, mailResults); }catch(e){ Logger.log('메일 발송 실패: ' + e.message); }
}

