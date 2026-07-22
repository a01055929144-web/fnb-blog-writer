

/* ══════════════════════════════════════
   매일 오전 8시 자동 발행 (서버사이드 v1)
   — 클라이언트 index.html의 buildPostSystemPrompt/buildPostUserPrompt를 그대로 이식
══════════════════════════════════════ */

const GENERAL_DATA_SRV = {
  '한식/축산': {
    season: {
      '1': '겨울철 보양식 수요 급증. 설렁탕·갈비탕 재료 납품량 최대. 한우 선물세트 납품 기회.',
      '2': '설 명절 한우·갈비 수요 폭증. 사전 물량 확보 필수. 제수용 고기 납품 기회.',
      '3': '봄 개학 시즌, 학교 급식 납품 기회. 봄나물·두릅 등 제철 식재료 수요 증가.',
      '4': '봄 나들이철, 고깃집 야외 시즌 시작. 삼겹살·목살 납품량 증가.',
      '5': '가정의 달, 가족 외식 증가. 한우 프리미엄 수요 상승.',
      '6': '보양식 시즌 시작. 삼계탕 재료 수요 급증. 닭고기·황기·대추 납품 기회.',
      '7': '복날 삼계탕 피크. 초복·중복·말복 전 물량 확보 필수.',
      '8': '말복 이후 가을 준비. 추어탕·보양 재료 전환.',
      '9': '추석 명절 한우·갈비 수요 폭증. 2-3주 전 선제 납품 준비.',
      '10': '가을 단풍철 나들이. 고깃집·한식당 방문객 증가.',
      '11': '김장철 돼지고기·수육 수요 증가. 겨울 보양식 준비 시작.',
      '12': '연말 회식 시즌. 삼겹살·갈비 납품량 연중 최대.'
    },
    trend: '건강식 한식 트렌드 강세. 한우 등급별 가격 차별화. 제주산·국내산 프리미엄 수요 증가.'
  },
  '일식/수산': {
    season: {
      '1': '겨울 제철 광어·방어 최성수기. 단가 낮고 품질 최고.',
      '2': '방어·과메기 마지막 시즌. 봄 도다리 준비.',
      '3': '봄 도다리·주꾸미 시즌 시작. 횟집 방문객 증가.',
      '4': '주꾸미·도다리 피크. 제철 수산물 납품 최적기.',
      '5': '전복·멍게 시즌. 회 소비 증가.',
      '6': '민어·장어 여름 보양 수산물 시즌 시작.',
      '7': '여름 피서철 회 수요 최고. 광어·우럭·농어 납품 피크.',
      '8': '늦여름 전어 시즌 시작. 가을 준비.',
      '9': '전어 피크 시즌. "가을 전어" 마케팅 활발.',
      '10': '가을 전어·꽃게 시즌. 방문객 증가.',
      '11': '가을 대게·굴 시즌 시작.',
      '12': '겨울 대게·방어 시즌. 연말 모임 수요 증가.'
    },
    trend: '수산물 원산지 표기 강화. 국산 활어 프리미엄화. 냉동보다 활어 선호도 상승.'
  },
  '양식/샐러드': {
    season: {
      '1': '겨울 브런치 수요. 뜨거운 수프·스튜 메뉴 인기.',
      '2': '발렌타인 시즌 파스타·스테이크 수요 증가.',
      '3': '봄 샐러드 메뉴 수요 시작. 신선 채소 수요 증가.',
      '4': '봄 나들이철 브런치·샐러드 수요 최고.',
      '5': '가정의 달 외식 증가. 스테이크 프리미엄 수요.',
      '6': '여름 샐러드·냉파스타 수요 시작.',
      '7': '여름 샐러드·냉파스타 수요 최고.',
      '8': '늦여름 시원한 메뉴 지속. 여름 휴가철 관광지 매출 증가.',
      '9': '가을 시즌 메뉴 전환. 리조또·스튜류 준비.',
      '10': '가을 트러플·버섯 시즌. 프리미엄 메뉴 수요.',
      '11': '연말 파티시즌 준비. 스테이크·와인 수요 증가.',
      '12': '연말 파티 시즌 피크. 프리미엄 스테이크·와인 매출 최대.'
    },
    trend: '건강식 샐러드 트렌드 지속. 로컬 신선 채소 수요 증가. 비건 옵션 요구 확대.'
  },
  '중식': {
    season: {
      '1': '겨울 얼큰한 짬뽕류 수요 증가.',
      '2': '설 명절 이후 회복식 수요.',
      '3': '봄 신메뉴 시즌.',
      '4': '봄나들이 배달 수요 증가.',
      '5': '가정의 달 외식·배달 증가.',
      '6': '여름 냉채류 메뉴 수요 시작.',
      '7': '여름 배달 피크. 짜장·짬뽕 재료 수요 최대.',
      '8': '늦여름 배달 지속 강세.',
      '9': '추석 이후 회복식 수요.',
      '10': '가을 정상 수요.',
      '11': '연말 회식 시즌 시작.',
      '12': '연말 회식·배달 피크.'
    },
    trend: '고급 중식 프리미엄화. 딤섬·정통 중식 수요 증가. 배달 전용 메뉴 다양화.'
  },
  '주류': {
    season: {
      '1': '신년회 시즌. 프리미엄 주류 수요.',
      '2': '설 명절 선물세트 수요.',
      '3': '봄 개강 시즌 회식 증가.',
      '4': '봄 야외 모임 주류 수요 증가.',
      '5': '가정의 달 모임 증가.',
      '6': '여름 맥주 시즌 시작.',
      '7': '여름 맥주 피크. 수제맥주 트렌드 강세.',
      '8': '늦여름 맥주 수요 지속.',
      '9': '추석 명절 선물세트 수요.',
      '10': '가을 야외 모임 증가.',
      '11': '연말 모임 준비.',
      '12': '연말 회식·모임 피크. 주류 매출 연중 최대.'
    },
    trend: '수제맥주·전통주 트렌드 강세. 저도수 주류 수요 증가.'
  },
  '카페/베이커리': {
    season: {
      '1': '겨울 따뜻한 음료 수요. 신년 다이어리 마케팅.',
      '2': '발렌타인 초콜릿·디저트 수요 최대.',
      '3': '화이트데이 디저트 수요.',
      '4': '봄 플라워 카페 마케팅. 브런치 수요 증가.',
      '5': '가정의 달 케이크·선물 수요 증가.',
      '6': '초여름 음료 전환 시작.',
      '7': '여름 음료 피크. 빙수 재료 수요.',
      '8': '늦여름 빙수·냉음료 수요 지속.',
      '9': '가을 신메뉴 시즌. 시즌 한정 음료 출시.',
      '10': '가을 디저트 시즌.',
      '11': '연말 케이크 예약 시작.',
      '12': '연말 케이크·선물 수요 최대.'
    },
    trend: '스페셜티 원두 수요 증가. 비건 디저트 트렌드. 시즌 한정 메뉴 마케팅 강화.'
  },
  '소스/가공': {
    season: {
      '1': '겨울 국물류 소스 수요 증가.',
      '2': '설 명절 조미료·소스 선물세트.',
      '3': '봄 신학기 급식 소스 수요.',
      '4': '봄철 정상 수요.',
      '5': '가정의 달 정상 수요.',
      '6': '여름 소스 수요 전환.',
      '7': '여름 소스 피크.',
      '8': '늦여름 정상 수요.',
      '9': '추석 명절 조미료 선물세트.',
      '10': '가을 정상 수요.',
      '11': '김장철 양념류 수요 증가.',
      '12': '연말 정상 수요.'
    },
    trend: '무첨가·프리미엄 소스 트렌드. 지역 특산 소스 수요 증가.'
  }
};

function industryToGeneralKeySrv_(industry){
  var map = {
    '한식':'한식/축산', '축산':'한식/축산',
    '양식':'양식/샐러드', '샐러드':'양식/샐러드',
    '일식':'일식/수산', '수산':'일식/수산',
    '중식':'중식',
    '주류':'주류',
    '카페베이커리':'카페/베이커리',
    '공산품':'소스/가공'
  };
  return map[industry] || industry;
}

function chunkLinesForReadabilitySrv_(lines, n){
  var groups = [];
  for(var i=0; i<lines.length; i+=n){
    groups.push(lines.slice(i, i+n).join('\n'));
  }
  return groups.join('\n\n');
}

/* 클라이언트 buildPostSystemPrompt와 동일 (함수명만 _Srv 접미) */
function buildPostSystemPromptSrv_(industry, intent, priceData, priceStats){
  intent = intent || '업체찾기';

  var gKey = industryToGeneralKeySrv_(industry);
  var gData = GENERAL_DATA_SRV[gKey] || {};
  var thisMonth = String(new Date().getMonth()+1);
  var seasonNote = gData.season ? (gData.season[thisMonth]||'') : '';
  var trendNote = gData.trend || '';

  var intentGuide = {
    '업체찾기':'식자재 납품업체를 찾고 있음. 어떻게 업체를 찾는지, 무엇을 비교해야 하는지가 핵심.',
    '창업비용':'창업 비용이 궁금함. 식자재 구매 비용이 전체 창업에서 어느 정도 비중인지가 핵심.',
    '원가절감':'원가를 줄이고 싶음. 식자재 단가를 어떻게 낮출 수 있는지가 핵심.',
    '납품':'납품 방식이 궁금함. 주기/물량/긴급납품/담당자 소통이 핵심.',
    '식재료':'어떤 식재료를 써야 하는지 모름. 업종별 필수 식재료와 품질 기준이 핵심.',
    '상권':'지역 상권이 궁금함. 해당 지역에서 식자재 공급이 어떻게 이루어지는지가 핵심.',
    '운영':'매장 운영 효율화. 식자재 관리와 발주 효율화가 핵심.'
  };
  var intentDesc = intentGuide[intent]||intentGuide['업체찾기'];

  var criteriaMap = {
    '업체찾기': {title:'납품업체 선택 기준 5가지', focus:'배송 경험, 냉장·보관 상태, 규격과 원산지 정확성, 최소 주문량, 교환·반품 처리'},
    '창업비용': {title:'식자재 비용 절감 기준 5가지', focus:'최소 발주량, 배송비 구조, 정산 조건, 초기 재고 부담, 대체 품목 활용'},
    '원가절감': {title:'원가 절감 체크포인트 5가지', focus:'정기거래 할인, 발주 단위 최적화, 대체 품목, 배송비 절감, 폐기율 관리'},
    '납품':     {title:'납품 조건 확인 기준 5가지', focus:'배송 주기, 긴급 발주 가능 여부, 최소 주문량, 담당자 소통, 정산 방식'},
    '식재료':   {title:'식재료 품질 확인 기준 5가지', focus:'원산지, 규격, 신선도 관리, 손질 여부, 보관 상태'},
    '상권':     {title:'지역 상권 식자재 확인 기준 5가지', focus:'지역 유통 구조, 배송 접근성, 주변 매장 공급처, 지역 특화 품목, 신규 진입 조건'},
    '운영':     {title:'식자재 운영 효율화 기준 5가지', focus:'발주 주기 최적화, 재고 관리, 폐기율 관리, 정기 거래처 확보, 긴급 발주 대응'}
  };
  var criteria = criteriaMap[intent] || criteriaMap['업체찾기'];

  var priceTable = '';
  var hasPrice = priceData && priceData.prices && priceData.prices.length>0;
  if(hasPrice){
    var priceLines = priceData.prices.map(function(p){
      return '· '+p.name+' — '+p.wholesale+'원/'+p.unit;
    });
    priceTable = chunkLinesForReadabilitySrv_(priceLines, 5);
  }

  var statsTable = '', periodLabel = '';
  var hasStats = priceStats && priceStats.success && priceStats.stats && priceStats.stats.length > 0;
  if(hasStats){
    periodLabel = priceStats.periodLabel || '';
    var indStats = (priceStats.grouped && priceStats.grouped[industry]) || priceStats.stats.slice(0,10);
    var statsLines = indStats.slice(0,8).map(function(p){
      return '· '+p.item+' — 평균 '+p.avg+'원 (최저 '+p.min+'원 · 최고 '+p.max+'원, '+p.unit+')';
    });
    statsTable = chunkLinesForReadabilitySrv_(statsLines, 5);
  }

  var priceAlerts = '';
  if(hasPrice && hasStats){
    var statsByItem = {};
    (priceStats.stats||[]).forEach(function(s){ statsByItem[s.item] = s; });
    var alerts = [];
    priceData.prices.forEach(function(p){
      var baseName = (p.name||'').split('/')[0];
      var matched = statsByItem[p.name] || statsByItem[baseName];
      if(matched && matched.avg){
        var cur = parseFloat(String(p.wholesale).replace(/,/g,''));
        var avg = parseFloat(String(matched.avg).replace(/,/g,''));
        if(!isNaN(cur) && !isNaN(avg) && avg > 0){
          var diffPct = Math.round((cur-avg)/avg*100);
          if(Math.abs(diffPct) >= 8){
            alerts.push(p.name+' 평균 대비 '+(diffPct>0?'+':'')+diffPct+'% '+(diffPct>0?'상승':'하락'));
          }
        }
      }
    });
    if(alerts.length) priceAlerts = alerts.slice(0,5).join(' / ');
  }

  var month = new Date().getMonth()+1;
  var mn = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  var todayLabel = new Date().getFullYear()+'년 '+mn[month];

  return '【최우선 규칙 — 문체】 이 글은 반드시 부드러운 해요체로만 씁니다. "~습니다", "~합니다", "~입니다", "~됩니다", "~해야 합니다", "~할 수 있습니다" 같은 격식체(다나까체)는 절대, 단 한 문장도 쓰지 않습니다.\n'
    +'변환 예시 — 이렇게 바꿔서 씁니다:\n'
    +'  "확인해야 합니다" → "확인해야 해요"\n'
    +'  "중요합니다" → "중요해요"\n'
    +'  "달라질 수 있습니다" → "달라질 수 있어요"\n'
    +'  "필요합니다" → "필요해요"\n'
    +'  "됩니다" → "돼요"\n'
    +'  "좋습니다" → "좋아요"\n'
    +'  "선택하는 것이 유리합니다" → "선택하는 게 유리해요"\n'
    +'표(|) 안의 셀 내용에는 이 규칙을 적용하지 않습니다(짧은 값이므로).\n'
    +'글을 다 쓴 뒤에도, "다"로 끝나는 문장이 있으면 안 됩니다. 스스로 점검하면서 쓰세요.\n\n'

    +'당신의 목적은 지역과 업종에 맞는 식자재 업체를 찾는 사람에게 도움을 주는 것입니다. 네이버 블로그에 그대로 발행할 완성된 글을 마크다운으로 작성합니다.\n'
    +'마지막에는 BIV가 "찾는 것을 도와주는 서비스"라는 점을 자연스럽게 설명합니다.\n\n'

    +'[공통 배경 정보]\n'
    +'기준일: '+todayLabel+'\n'
    +'업종: '+industry+'\n'
    +'검색의도: '+intent+' — '+intentDesc+'\n'
    +(seasonNote ? '이달의 시즌 이슈: '+seasonNote+'\n' : '')
    +(trendNote ? '업계 트렌드: '+trendNote+'\n' : '')
    +(priceAlerts ? '오늘 시세 특이사항(평균 대비 8% 이상 변동): '+priceAlerts+'\n' : '')
    +(hasPrice?'오늘 공급가(수정 금지, 목록 그대로 사용, 출처: KAMIS 공공데이터):\n'+priceTable+'\n':'')
    +(hasStats?periodLabel+' 단가 통계(수정 금지, 목록 그대로 사용, 출처: KAMIS 공공데이터):\n'+statsTable+'\n':'')
    +'\n'

    +'[절대 규칙]\n'
    +'① 이모지 완전 금지 — 제목 포함 글 전체에 이모지 없음. BIV는 전문 브랜드.\n'
    +'② 마크다운 사용: #/## 제목, **볼드**는 적극 사용. 단 표(|)는 모바일 화면에서 좁게 눌려 보여서 절대 사용하지 말 것 — 대부분의 독자가 모바일로 읽는다는 점을 최우선으로 고려. 가격 정보와 체크리스트는 모두 "· " 로 시작하는 줄로 나열할 것 (위 [공통 배경 정보]의 목록 형식 그대로).\n'
    +'③ 문장은 짧게 끊고, 한 줄에 2~4단어 정도로 자주 줄바꿈할 것 (모바일 가독성용 스크립트체). 한 문단은 2~3줄을 넘기지 않음.\n'
    +'④ 글 맨 앞에 짧은 인사말 1줄로 시작할 것 (예: "안녕하세요, BIV입니다." 또는 이와 비슷한 간결한 인사). 길게 자기소개하지 말고 딱 1줄만.\n'
    +'⑤ 절대 지어내지 말 것: "한 예비 창업자가 있었어요" 같은 특정 인물·날짜·구체적 스토리는 금지. 대신 "이런 상황이 흔해요"처럼 일반화된 패턴으로만 서술.\n'
    +'⑤-1 퍼센트·수치 규칙: 위에 제공된 목록의 실제 가격 두 개를 직접 비교해서 계산한 퍼센트는 사용 가능하고 오히려 권장함. 하지만 "배송비는 발주액의 5~10%", "여유분 20~30%를 더해서 발주", "월 O% 절감 가능"처럼 목록에 없는 일반적인 업계 통계·경험칙·효과 예측 수치는 절대 지어내지 말 것.\n'
    +'⑤-2 "차로 15~20분 거리", "식당 밀집 상권" 같이 근거 없는 구체적 거리·시간·밀집도 표현도 금지. 확인 안 된 구체적 수치 대신 "비교적 가까운 편이에요"처럼 일반화해서 서술할 것.\n'
    +'⑥ 핵심키워드 전체 문구는 도입/본문 중간/마무리에 각 1회씩만, **볼드**로 자연스럽게 포함. 그 외 부분에서는 핵심키워드를 그대로 반복하지 말고, 키워드를 쪼갠 관련 하위 표현들을 상황에 맞게 나누어 쓸 것. 기계적 반복 금지.\n'
    +'⑦ 과장/광고/1위/최고 금지.\n'
    +'⑦-1 제목은 사용자 메시지의 "제목형식"을 기반으로 하되, 단어 사이 띄어쓰기가 어색하게 붙어있으면 자연스럽게 띄어써서 다듬을 것(의미와 핵심키워드는 그대로 유지). 쉼표(,)는 자연스러운 구절 구분이면 유지해도 되지만, 대괄호[ ], 소괄호( ) 는 절대 사용하지 말 것 — 네이버 검색 누락(색인 제외) 원인이 됨.\n'
    +'⑦-1-1 제목형식 안에 지역명이나 업종명이 이미 두 번 이상 들어가 있으면, 자연스럽게 한 번만 남기고 정리할 것.\n'
    +'⑦-2 같은 단어를 본문에서 바로 옆이나 가까운 거리에 두 번 연속 쓰지 말 것. 문장이 끝나면 마침표를 찍을 것.\n'
    +(hasPrice ? '⑧ 사용자 메시지의 핵심키워드에 나오는 구체적 식재료명이 위 공급가 목록의 품목과 다르면, "프리미엄/특수 품목은 별도 견적" 섹션에서 "공공 시세 데이터에 없어 업체별 견적 확인이 필요하다"고 짚어줄 것. 목록에 없는 가격을 지어내지 말 것.\n' : '')
    +'⑨ 마무리(상담 유도) 표현은 "## 마무리" 섹션에서 딱 1번만 쓸 것. 다른 섹션(도입, 본문 등)에서 "상담받아보세요", "문의해주세요" 같은 유도 문구를 반복하지 말 것.\n'
    +(seasonNote||trendNote||priceAlerts ? '⑩ 위 [공통 배경 정보]에 "이달의 시즌 이슈"/"업계 트렌드"/"오늘 시세 특이사항"이 있다면, 이 글의 키워드·타입과 자연스럽게 맞아떨어지는 곳에 1~2곳 정도 자연스럽게 녹여 쓸 것 — 매 섹션에 억지로 넣지 말고, 이 글에서 진짜 관련 있는 부분에서만.\n' : '')
    +'\n'

    +'[출력 형식 — 이 순서와 마크다운 헤더 그대로. 아래 사용자 메시지의 지역/업종/키워드/제목형식을 실제 값으로 채워 넣을 것]\n\n'

    +'# (사용자 메시지의 제목형식 그대로, 30~35자 이내)\n\n'

    +'## (2줄로 나눈 도입 소제목, 예: "{지역} {업종} 창업," / "거래처부터 정해야 해요")\n'
    +'(검색의도 기준 — 이 사람이 지금 어떤 상황인지 공감하며 시작. 4~6문단, 각 2~3줄. 핵심키워드 볼드로 1회 포함.)\n\n'

    +(hasPrice ? ('---\n\n## '+todayLabel+' 기준 식자재 참고 공급가\n(위 [공통 배경 정보]의 공급가 목록 그대로, "· " 줄글 형식 유지 — 표 사용 금지)\n※ 위 가격은 KAMIS 공공데이터 기준 참고용이며, 조회 시점과 시장 상황·규격에 따라 실제 납품가는 달라질 수 있습니다.\n목록에 없는 품목은 별도 견적이 필요하다고 짧게 언급.\n\n') : '')
    +(hasStats ? ('---\n\n## '+periodLabel+' 단가 동향 (KAMIS 공공데이터 기준)\n(위 [공통 배경 정보]의 단가 통계 목록 그대로, "· " 줄글 형식 유지 — 표 사용 금지)\n\n') : '')

    +(hasPrice ? ('---\n\n## 핵심 품목 상세 정보\n'
      +'(사용자 메시지의 핵심키워드가 가리키는 구체적 품목 하나를 골라 깊이 있게 다룰 것. 확인 안 된 수치는 절대 지어내지 말 것. 3~5문단.)\n\n') : '')

    +'---\n\n## BIV가 먼저 보는 3가지\n'
    +'(이 글의 핵심키워드·지역·업종에 맞는 소제목 3개를 매번 새롭게 직접 지을 것. 각 2~4문단. 근거 없는 구체적 이동시간/거리는 쓰지 말 것.)\n\n'

    +'---\n\n## '+criteria.title+'\n'
    +'다음 5가지를 ### 소제목으로 각각 작성 (각 2~4문단): '+criteria.focus+'\n\n'

    +'---\n\n## 식자재 공급 경로\n'
    +'(도매시장 직접구매 / 전문 납품업체 / 품목별 전문업체라는 3가지 큰 범주는 유지하되, 소제목 표현은 매번 새롭게 지을 것. 각 장단점 2~3문단)\n\n'

    +(hasPrice ? '---\n\n## 프리미엄·특수 품목은 별도 견적이 필요해요\n(목록에 없는 고가/특수 품목은 공공 시세로 알기 어렵다는 내용. 2~3문단.)\n\n' : '')

    +'---\n\n## 자주 겪는 상황\n'
    +'(이 키워드·품목·업종에 맞는 구체적인 흔한 상황 2~3개를 매번 다르게 골라 서술. 특정 인물·날짜를 지어내지 말 것. 3~4문단.)\n\n'

    +'---\n\n## 계약 전 확인표\n'
    +'("· " 로 시작하는 줄로 12~15개. 5개마다 줄바꿈을 한 번 더 넣어서 그룹으로 나눠 쓸 것.)\n\n'

    +'---\n\n## 자주 묻는 질문\n'
    +'### Q1. (검색의도 관련 실제로 자주 나오는 질문)\n(2~3문단 답변)\n\n'
    +'### Q2. (질문)\n(답변)\n\n'
    +'### Q3. (질문)\n(답변)\n\n'

    +'---\n\n## BIV가 도와드리는 과정\n'
    +'(실제 상담이 어떻게 진행되는지 3~5단계로, 매번 스스로 다르게 구성할 것. 불릿(*)으로 짧게.)\n\n'

    +'---\n\n## 마무리\n'
    +'핵심키워드 볼드로 포함해서 2~3문단. 마지막 문장은 반드시 "지금 아래에서 편하게 상담받아보세요" 또는 비슷한 표현으로 끝낼 것.\n\n'

    +'---\n\n## 핵심 요약\n'
    +'(2~3문단, 전체 내용 요약.)\n\n'

    +'해시태그: BIV 고정태그 10개 필수 포함 후 SEO 태그 10개 추가, 총 20개, 마지막 줄에 한 줄로.\n'
    +'고정: #식자재납품 #식재료도매 #식당창업 #식자재원가 #납품업체 #식재료공급 #창업준비 #외식업창업 #식자재유통 #BIV\n'
    +'추가: 지역+업종+검색의도에 맞는 SEO 키워드 10개'
    ;
}

function buildPostUserPromptSrv_(kw, region, type, industry){
  var regionParts = (region||'서울').split(' ');
  var sido = regionParts[0]||'서울';
  var gugun = regionParts.slice(1).join(' ')||'';
  var loc = gugun || sido;

  var cuisineTypes = ['한식','양식','일식','중식'];
  var indLabel = cuisineTypes.indexOf(industry) > -1 ? industry+'당' : industry;

  var locStem = loc.replace(/(특별시|광역시|자치시|자치도|[시도군구])$/,'') || loc;
  var kwHasLoc = locStem && kw.indexOf(locStem) > -1;
  var kwHasInd = industry && kw.indexOf(industry) > -1;

  var titlePatterns;
  if(kwHasLoc && kwHasInd){
    titlePatterns = [
      kw+' 전 확인할 5가지', kw+' 시 비교할 것', kw+' 정리', kw+' 선택 기준',
      kw+' 계약 전 체크리스트', kw+' 절감 가이드', kw+' 안내', kw+' 확인하기'
    ];
  } else {
    titlePatterns = [
      loc+' '+indLabel+' 창업, '+kw+' 전 확인할 5가지',
      kw+' 도매업체, '+loc+' '+indLabel+' 창업 전 비교할 것',
      loc+' '+indLabel+' 창업 준비, '+kw+' 정리',
      kw+' 공급업체 선택 기준, '+loc+' '+indLabel+' 기준',
      loc+' '+indLabel+', '+kw+' 계약 전 체크리스트',
      kw+' 원가절감, '+loc+' '+indLabel+' 창업 가이드',
      loc+' '+indLabel+' 창업자를 위한 '+kw+' 안내',
      kw+' 비교, '+loc+' '+indLabel+' 도매가 확인하기'
    ];
  }
  var patternIdx = kw.split('').reduce(function(acc,c){return acc+c.charCodeAt(0);},0) % titlePatterns.length;
  var titleTemplate = titlePatterns[patternIdx]
    .replace(/[\[\]()（）]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  var typeFormats = {
    '정보글':'정보 전달형 — 창업자가 몰랐던 실용 정보 중심',
    '가이드':'단계별 가이드 — 순서대로 이렇게 하세요',
    '체크리스트':'체크리스트형 — 확인해야 할 항목 나열',
    '비교':'비교형 — A vs B, 어떤 게 나은지',
    'TOP5':'TOP5형 — 핵심 포인트 5가지',
    'FAQ':'FAQ형 — 실제 상담에서 나온 질문 중심',
    '실수':'실수형 — 창업자들이 자주 하는 실수',
    '비용':'비용형 — 얼마나 드는지, 어디서 아낄 수 있는지',
    '후기형':'후기형 — 실제 경험담처럼 자연스럽게',
    '오늘단가':'오늘 단가 분석 — KAMIS 실거래가 기반 당일 시세 정보글',
    '주간단가':'주간 단가 동향 — 최근 7일 평균 시세 분석글',
    '월간단가':'월간 단가 리포트 — 최근 1개월 평균·최고·최저가 분석글',
    '분기단가':'분기 단가 리포트 — 최근 3개월 평균·최고·최저가 분석 및 분기 트렌드글',
    '연간단가':'연간 단가 리포트 — 최근 1년 평균·최고·최저가 분석 및 연간 트렌드글'
  };
  var typeDesc = typeFormats[type]||typeFormats['정보글'];

  var month = new Date().getMonth()+1;
  var mn = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  var today = new Date().getFullYear()+'년 '+mn[month];

  return '[입력값]\n'
    +'날짜: '+today+'\n'
    +'지역: '+region+'\n'
    +'핵심키워드: "'+kw+'"\n'
    +'글 타입: '+type+' — '+typeDesc+'\n'
    +'제목형식: '+titleTemplate+'\n\n'
    +'위 system 지시사항(공통 배경 정보/절대 규칙/출력 형식)에 따라 이 입력값으로 글을 작성하세요.\n'
    +'다시 한번: 전부 해요체로 쓰세요. "~습니다/합니다/입니다/됩니다"는 절대 쓰지 마세요.';
}

/* Sonnet 모델 + system prompt(캐싱) 지원 — 매일 자동 글쓰기 전용 */
function callClaudeSonnetSrv_(systemPrompt, userPrompt, maxTokens){
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음');
  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens || 10000,
    messages: [{role:'user', content: userPrompt}]
  };
  if(systemPrompt){
    payload.system = [{type:'text', text:systemPrompt, cache_control:{type:'ephemeral'}}];
  }
  var res = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: {'x-api-key': apiKey, 'anthropic-version': '2023-06-01'},
    payload: JSON.stringify(payload)
  });
  var status = res.getResponseCode();
  var body = JSON.parse(res.getContentText());
  if (status < 200 || status >= 300) throw new Error('Claude API ' + status + ': ' + res.getContentText().substring(0,200));
  var textBlock = (body.content||[]).find(function(b){ return b.type==='text'; });
  if(!textBlock) throw new Error('Claude 응답에 텍스트 없음');
  if(body.stop_reason === 'max_tokens'){
    // 잘렸으면 1회 재시도(더 큰 토큰)
    return callClaudeSonnetSrv_(systemPrompt, userPrompt, Math.min(maxTokens*2, 16000));
  }
  return textBlock.text;
}

/* 파싱 로직 (클라이언트 writeOnePost와 동일) + 시트 저장 */
function writeAndSaveOnePostSrv_(kw, region, industry, type, priceData, priceStats, intent){
  var sysPrompt = buildPostSystemPromptSrv_(industry, intent||'업체찾기', priceData||null, priceStats||null);
  var userPrompt = buildPostUserPromptSrv_(kw, region, type, industry);
  var text = callClaudeSonnetSrv_(sysPrompt, userPrompt, 10000);

  var titleM = text.match(/^#(?!#)\s*(.+)$/m);
  var title = titleM ? titleM[1].trim()
    .replace(/\*\*/g,'')
    .replace(/[\[\]()（）,，]/g,'')
    .replace(/\s{2,}/g,' ')
    .trim() : kw;

  var hashtagIdx = text.search(/해시태그\s*[:：]/);
  if(hashtagIdx === -1){
    var tailLines = text.split('\n');
    for(var li=tailLines.length-1; li>=0; li--){
      var ln = tailLines[li].trim();
      if(!ln) continue;
      var tagWords = ln.match(/#[\w가-힣]+/g)||[];
      if(tagWords.length >= 5 && tagWords.join('').length >= ln.replace(/\s/g,'').length*0.7){
        hashtagIdx = text.lastIndexOf(tailLines[li]);
      }
      break;
    }
  }
  var tagsBlock = hashtagIdx > -1 ? text.slice(hashtagIdx) : '';
  var rawTags = tagsBlock.match(/#[\w가-힣]+/g) || [];
  var fixedTagsStr = '#식자재납품 #식재료도매 #식당창업 #식자재원가 #납품업체 #식재료공급 #창업준비 #외식업창업 #식자재유통 #BIV';
  var fixedTags = fixedTagsStr.match(/#[\w가-힣]+/g)||[];
  var tags = fixedTags.concat(rawTags.filter(function(t){ return fixedTags.indexOf(t)===-1; }));

  var bodyStart = titleM ? (titleM.index + titleM[0].length) : 0;
  var bodyEnd = hashtagIdx > -1 ? hashtagIdx : text.length;
  var body = text.slice(bodyStart, bodyEnd)
    .replace(/\n+(?:해시태그\s*[:：].*|고정\s*[:：].*|추가\s*[:：].*|(?:#[\w가-힣]+\s*){5,})\s*$/g, '')
    .trim();

  if(!text || !body || body.trim().length < 30 || !title){
    return {success:false, message:'생성된 콘텐츠가 비어있음'};
  }

  var saveResult = savePost_({
    sheetId: getSheetId_(),
    date: new Date().toLocaleDateString('ko-KR'),
    region: region,
    sido: region.split(' ')[0]||'',
    gugun: region.split(' ').slice(1).join(' ')||'',
    keyword: kw, industry: industry, type: type, title: title,
    body: body, hashtags: tags.join(' '), chars: body.length
  });

  return {success:true, title:title, kw:kw, row: saveResult && saveResult.row};
}

/* 이슈 감지 (가격급등락 + 계절노트) — 클라이언트 startIssueBatch와 동일 로직 */
function detectDailyIssueSrv_(region, industry, priceData, priceStats){
  var gKey = industryToGeneralKeySrv_(industry);
  var gData = GENERAL_DATA_SRV[gKey] || {};
  var thisMonth = String(new Date().getMonth()+1);
  var seasonNote = gData.season ? (gData.season[thisMonth]||'') : '';

  var issues = [];
  if(priceData && priceData.prices && priceStats && priceStats.success && priceStats.stats){
    var statsByItem = {};
    priceStats.stats.forEach(function(s){ statsByItem[s.item] = s; });
    priceData.prices.forEach(function(p){
      var baseName = (p.name||'').split('/')[0].trim();
      var matched = statsByItem[p.name] || statsByItem[baseName];
      if(matched && matched.avg && baseName){
        var cur = parseFloat(String(p.wholesale).replace(/,/g,''));
        var avg = parseFloat(String(matched.avg).replace(/,/g,''));
        if(!isNaN(cur) && !isNaN(avg) && avg>0){
          var diffPct = Math.round((cur-avg)/avg*100);
          if(Math.abs(diffPct) >= 8){
            issues.push({kw: baseName+' 가격 '+(diffPct>0?'급등':'급락')+' 원인', type:'오늘단가', score: Math.abs(diffPct)});
          }
        }
      }
    });
    issues.sort(function(a,b){ return b.score-a.score; });
  }
  if(seasonNote){
    var issueCore = seasonNote.split(/[.。]/)[0].trim();
    if(issueCore.length > 16) issueCore = issueCore.slice(0,16);
    var locWord = region.split(' ').pop();
    var seasonKw = issueCore ? (locWord+' '+industry+' '+issueCore) : (industry+' 창업 시즌 준비');
    issues.push({kw: seasonKw, type:'정보글', score: 0});
  }
  return issues.length ? issues[0] : {kw: industry+' 창업 준비 가이드', type:'정보글', score:0};
}

/* 일반 키워드 1개 생성 (Haiku, 저렴) */
function generateGeneralKeywordSrv_(region, industry){
  try{
    var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    var prompt = 'F&B 식자재 블로그 네이버 SEO 키워드 1개만 JSON으로.\n'
      +'업종:'+industry+' / 지역:'+region+'\n'
      +'타겟:신규창업 사장님. 구매/창업의도 롱테일 키워드.\n'
      +'{"keyword":"강남 고깃집 창업 납품업체","intent":"창업"}\n'
      +'JSON만 출력.';
    var res = UrlFetchApp.fetch(ANTHROPIC_API_URL, {
      method:'post', muteHttpExceptions:true, contentType:'application/json',
      headers:{'x-api-key':apiKey, 'anthropic-version':'2023-06-01'},
      payload: JSON.stringify({model:'claude-haiku-4-5-20251001', max_tokens:300, messages:[{role:'user',content:prompt}]})
    });
    var body = JSON.parse(res.getContentText());
    var textBlock = (body.content||[]).find(function(b){ return b.type==='text'; });
    var clean = textBlock.text.replace(/```json|```/g,'').trim();
    var jS = clean.indexOf('{'), jE = clean.lastIndexOf('}');
    var parsed = JSON.parse(clean.slice(jS,jE+1));
    return {kw: parsed.keyword, intent: parsed.intent||'업체찾기'};
  }catch(e){
    return {kw: industry+' 식자재 납품업체 '+region.split(' ').pop(), intent:'업체찾기'};
  }
}

/* 자동화 설정 저장/조회 — 새 시트 '자동화설정' 사용 */
function saveAutoConfig_(data){
  try{
    var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
    var sheet = ss.getSheetByName('자동화설정') || ss.insertSheet('자동화설정');
    sheet.clear();
    sheet.appendRow(['지역','업종','발행시각(시)']);
    (data.list||[]).forEach(function(c){
      sheet.appendRow([c.region, c.industry, data.hour||8]);
    });
    return {success:true, count:(data.list||[]).length};
  }catch(e){
    return {success:false, message:e.message};
  }
}

function getAutoConfig_(data){
  try{
    var ss = SpreadsheetApp.openById(data.sheetId || getSheetId_());
    var sheet = ss.getSheetByName('자동화설정');
    if(!sheet || sheet.getLastRow() < 2) return {success:true, list:[]};
    var rows = sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
    var list = rows.filter(function(r){ return r[0]; }).map(function(r){ return {region:r[0], industry:r[1]}; });
    return {success:true, list:list};
  }catch(e){
    return {success:false, message:e.message};
  }
}

/* 매일 오전 8시 트리거 실행 함수 — 로테이션 지역/업종으로 이슈글1 + 일반글1 작성 */
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

  // ① 오늘의 이슈 글
  try{
    var issue = detectDailyIssueSrv_(region, industry, priceData, priceStats);
    writeAndSaveOnePostSrv_(issue.kw, region, industry, issue.type, priceData, priceStats, '업체찾기');
    Logger.log('✅ 이슈글 완료: ' + issue.kw);
  }catch(e){ Logger.log('❌ 이슈글 실패: ' + e.message); }

  // ② 일반 키워드 글
  try{
    var gen = generateGeneralKeywordSrv_(region, industry);
    writeAndSaveOnePostSrv_(gen.kw, region, industry, '가이드', priceData, priceStats, gen.intent);
    Logger.log('✅ 일반글 완료: ' + gen.kw);
  }catch(e){ Logger.log('❌ 일반글 실패: ' + e.message); }
}

/* 매일 오전 8시 트리거 설치 (한 번만 실행하면 됨) */
function setup8amAutoWriteTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'dailyAutoWrite') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyAutoWrite').timeBased().atHour(8).everyDays(1).create();
  Logger.log('✅ 매일 오전 8시 자동 발행 트리거 설치 완료');
}
