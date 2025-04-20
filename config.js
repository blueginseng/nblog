require('dotenv').config();

module.exports = {
    /* …기존 필드… */
  pagesDepth   : 10,            // ← 스캔 페이지 최대 깊이
  keywordRatio : { main: 0.25, related: 0.5, priority: 0.25 }, // 선택 비율
      
  cafeUrl      : process.env.CAFE_URL ?? 'https://blog.naver.com/blueginseng',
  keyword      : '아보츠포드',
  searchUrl    : 'https://search.naver.com/search.naver',

  /* 동작 파라미터 */
  visitDelay   : { min: 15, max: 45 },
  searchCount  : 100,
  clickThrough : true,
  stayDuration : { min: 60, max: 300 },

  /* 실행 옵션 */
  headless     : process.env.HEADLESS === 'true',
  debug        : process.env.DEBUG   !== 'false',

  /* 기타 */
  relatedKeywords : [
    '아보츠포드 뉴스','아보츠포드 교육청','아보츠포드 학교',
    
    ],
  priorityKeywords : [               // ⭐ 추가
   '아보츠포드 밀레이크',
   '아보츠포드 교육청'
    ],
  proxies        : process.env.PROXIES ? process.env.PROXIES.split(',').map(s => s.trim()) : [],
  userDataDirs   : './browser-profiles-naver',
  logPath        : './naver-seo-logs.json',
  debugDir       : './debug-info'
};
