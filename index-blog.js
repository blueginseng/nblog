/* eslint-disable no-console */
/*───────────────────────────────────────────────────────────
   Naver Blog SEO Bot  (blog.naver.com/blueginseng 전용)
───────────────────────────────────────────────────────────*/

const puppeteer      = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
const fsAsync        = require('fs').promises;
const path           = require('path');
const UserAgent      = require('user-agents');
const ProxyChain     = require('proxy-chain');

const { randInt, clampLog } = require('./utils');
const cfg            = require('./config');

puppeteer.use(StealthPlugin());

/* 블로그 도메인·경로 추출 */
const TARGET_URL   = new URL(cfg.blogUrl || cfg.cafeUrl);   // 호환을 위해 이름 유지
const TARGET_HOST  = TARGET_URL.host;                       // blog.naver.com
const TARGET_PATH  = TARGET_URL.pathname.replace(/^\//, '');/* blueginseng */

class NaverBlogSEO {
  constructor (cfg) {
    this.config = { ...cfg, headless: cfg.headless ?? false, debug: cfg.debug ?? true };
    this.stats  = { totalSearches: 0, successfulClicks: 0, positionHistory: [], searchLog: [] };

    /* 필수 디렉터리 생성 */
    for (const dir of [this.config.userDataDirs, this.config.debugDir])
      if (dir && !require('fs').existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
  }

  /*────────── 핵심 루프 ──────────*/
  async start () {
    console.log(`[시작] 총 ${this.config.searchCount}회 검색  (타겟: ${TARGET_URL.href})`);
    for (let i = 0; i < this.config.searchCount; i++) {
      const kw = this.pickKeyword();
      console.log(`[검색] "${kw.value}"  <${kw.type}>`);
      await this.performSearch(kw.value).catch(console.error);
      console.log(`[통계] 누적 검색 ${this.stats.totalSearches} / 클릭 ${this.stats.successfulClicks}`);
      const w = randInt(this.config.visitDelay.min, this.config.visitDelay.max);
      console.log(`[대기] ${w}s`); await new Promise(r => setTimeout(r, w * 1000));
    }
    console.table({
      검색: this.stats.totalSearches,
      클릭: this.stats.successfulClicks,
      평균순위:
        this.stats.positionHistory.length
          ? (this.stats.positionHistory.reduce((a,b)=>a+b,0)/this.stats.positionHistory.length).toFixed(2)
          : 'N/A'
    });
  }

  pickKeyword () {
    const r = Math.random();
    if (r < 0.25 && this.config.priorityKeywords?.length)
      return { value: this.config.priorityKeywords[randInt(0,this.config.priorityKeywords.length-1)], type:'우선' };
    if (r < 0.75 && this.config.relatedKeywords?.length)
      return { value: this.config.relatedKeywords[randInt(0,this.config.relatedKeywords.length-1)], type:'연관' };
    return { value: this.config.keyword, type:'메인' };
  }

  /*────────── 검색 실행 ──────────*/
  async performSearch (keyword) {
    let browser, proxyUrl;
    const log = { keyword, time: new Date().toISOString(), found:false, clicked:false };
    try {
      /* 브라우저 설정 */
      const ua = new UserAgent({ deviceCategory:'desktop' }).toString();
      const opts = {
        headless : this.config.headless,
        args     : ['--no-sandbox','--disable-setuid-sandbox',`--user-agent=${ua}`,'--window-size=1920,1080']
      };
      if (this.config.proxies?.length) {
        const rawProxy = this.config.proxies[randInt(0,this.config.proxies.length-1)];
        try { proxyUrl = await ProxyChain.anonymizeProxy(rawProxy); opts.args.push(`--proxy-server=${proxyUrl}`); }
        catch(e){ console.warn('[프록시 실패] 우회 없이 진행'); }
      }
      browser = await puppeteer.launch(opts);
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(()=>delete navigator.webdriver);
      await page.goto('https://www.naver.com/',{waitUntil:'domcontentloaded'});
      await page.type('#query', keyword, {delay:120});
      await page.keyboard.press('Enter');
      await page.waitForNavigation({waitUntil:'networkidle2'});

      /* 검색 결과 스캔 (1~10 페이지) */
      for (let p=1; p<=10; p++){
        if (p>1){
          const sel = `a[href*="&start=${(p-1)*10+1}"]`;
          const btn = await page.$(sel);
          if(!btn) break;
          await Promise.all([btn.click(), page.waitForNavigation({waitUntil:'networkidle2'})]);
        }
        const result = await page.evaluate((host,path)=>{
          const list=[...document.querySelectorAll('a[href*="blog.naver.com"]')];
          const a=list.find(x=>x.href.includes(host) && x.href.includes(path));
          return a?{href:a.href,idx:list.indexOf(a)+1,text:a.textContent.trim()}:null;
        },TARGET_HOST,TARGET_PATH);

        if (result){
          const pos = (p-1)*10+result.idx;
          console.log(`[검색] 블로그 발견! ${pos}위 (${p}p ${result.idx}번째)`);
          log.found=true; log.position=pos; log.url=result.href;
          const clicked = await this.clickLink(page, result.href);
          if(clicked){ log.clicked=true; this.stats.successfulClicks++; }
          this.stats.positionHistory.push(pos);
          break;
        }
      }

      this.stats.totalSearches++;
    } catch(e){ console.error('[오류]',e.message); log.error=e.message; }
    finally{
      if(browser) await browser.close().catch(()=>{});
      if(proxyUrl) await ProxyChain.closeAnonymizedProxy(proxyUrl,true).catch(()=>{});
      this.stats.searchLog = clampLog([...this.stats.searchLog, log]);
    }
  }

  /*────────── 클릭 로직 ──────────*/
  async clickLink(page, url){
    try{
      console.log('[클릭시도]',url);
      await page.goto(url,{waitUntil:'networkidle2',timeout:60000});
      await page.waitForSelector('body',{timeout:30000});
      const stay=randInt(this.config.stayDuration.min,this.config.stayDuration.max);
      console.log(`[클릭] 로드 완료, ${stay}s 머무름`);
      await new Promise(r=>setTimeout(r,stay*1000));
      return true;
    }catch(e){ console.warn('[클릭 실패]',e.message); return false;}
  }
}

/*──────────────────────────────────────────────────────────*/
(async()=>{ await new NaverBlogSEO(cfg).start(); })();
