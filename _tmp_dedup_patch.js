function dailyAutoWrite(){
  var ss = SpreadsheetApp.openById(getSheetId_());
  var cfgSheet = ss.getSheetByName('자동화설정');
  if(!cfgSheet || cfgSheet.getLastRow() < 2){
    Logger.log('자동화설정 없음 — dailyAutoWrite 중단');
    return;
  }
  var rows = cfgSheet.getRange(2,1,cfgSheet.getLastRow()-1,2).getValues().filter(function(r){ return r[0]; });
  if(!rows.length) return;

  var dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  var idx = dayOfYear % rows.length;
  var region = rows[idx][0], industry = rows[idx][1];

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

function sendDailyWriteEmail_(region, industry, results){
  var today = new Date();
  var dateStr = today.getFullYear()+'년 '+(today.getMonth()+1)+'월 '+today.getDate()+'일';
  var okCount = results.filter(function(r){return r.ok;}).length;
  var subject = '[BIV] '+dateStr+' 자동 발행 완료 ('+okCount+'/'+results.length+')';
  var body = 'BIV 블로그 자동화 결과예요.\n\n'
    +'날짜: '+dateStr+'\n'
    +'오늘 담당 지역/업종: '+region+' · '+industry+'\n\n'
    +results.map(function(r,i){
      return (i+1)+'. ['+r.kind+'] '+(r.ok?'완료 - ':'실패 - ')+r.title;
    }).join('\n')
    +'\n\n이미지는 사이트(https://a01055929144-web.github.io/fnb-blog-writer/)에 접속하시면 자동으로 만들어져요.\n'
    +'시트에서 바로 확인: https://docs.google.com/spreadsheets/d/'+getSheetId_()+'/edit';
  MailApp.sendEmail('a01055929144@gmail.com', subject, body);
}

/* 중복 감지 (클라이언트 isDuplicatePost/_isSimilarKw/_normDup와 동일 로직) */
function normDupSrv_(s){
  return (s||'').toLowerCase().replace(/[\s,.!?·\-()\[\]~]/g,'');
}
function isSimilarKwSrv_(a, b){
  var na = normDupSrv_(a), nb = normDupSrv_(b);
  if(!na || !nb) return false;
  if(na === nb) return true;
  var shorter = na.length <= nb.length ? na : nb;
  var longer  = na.length <= nb.length ? nb : na;
  return shorter.length >= 6 && longer.indexOf(shorter) > -1;
}
function isDuplicatePostSrv_(region, industry, kw, existingPosts){
  return existingPosts.some(function(h){
    var sameIndustry = (h.industry||'') === (industry||'');
    var sameRegion = !region || !h.region || h.region === region;
    if(!sameIndustry || !sameRegion) return false;
    return isSimilarKwSrv_(h.kw||h.title||'', kw) || isSimilarKwSrv_(h.title||'', kw);
  });
}
function loadExistingPostsSrv_(){
  var ss = SpreadsheetApp.openById(getSheetId_());
  var sheet = ss.getSheetByName(SHEET.posts);
  if(!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1, 9).getValues();
  return rows.map(function(v){
    return { region: (v[2]||'')+((v[3]?' '+v[3]:'')), industry: v[4], kw: v[6], title: v[7] };
  });
}

