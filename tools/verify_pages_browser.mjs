// One owned browser and loopback server; no installation or persistent processes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const args=process.argv.slice(2),option=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
assert(option('--playwright-root') && option('--browser-executable'));
const {chromium}=createRequire(path.join(path.resolve(option('--playwright-root')),'package.json'))('playwright');
const site=path.resolve('site'),out=path.resolve('.local/redesign');fs.mkdirSync(out,{recursive:true});
const record={owner:'oss-redesign',purpose:'site and mobile gesture QA',nodePid:process.pid,started:new Date().toISOString(),checks:[]};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg'};
let server,launch,browser;
const timeout=setTimeout(()=>{console.error('QA timeout');void finish(1);},180000);
async function finish(code){await browser?.close();await launch?.close();if(server?.listening)await new Promise(r=>server.close(r));clearTimeout(timeout);record.finished=new Date().toISOString();record.browserExited=!launch||launch.process().exitCode!==null;record.serverClosed=!server?.listening;fs.writeFileSync(path.join(out,(option('--url')?'live-':'')+'pages-verification.json'),JSON.stringify(record,null,2));if(code)process.exitCode=code;}
try{
 let base=option('--url');
 if(!base){server=http.createServer((req,res)=>{let file=path.resolve(site,`.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);if(!file.startsWith(site+path.sep)&&file!==site){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 record.url=base;launch=await chromium.launchServer({headless:true,executablePath:option('--browser-executable')});record.browserPid=launch.process().pid;record.browserStarted=new Date().toISOString();record.command=launch.process().spawnargs;fs.writeFileSync(path.join(out,'pages-process.json'),JSON.stringify(record,null,2));
 browser=await chromium.connect(launch.wsEndpoint());const page=await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const noOverflow=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+p.url());
 const shot=async(p,name,fullPage=false)=>p.screenshot({path:path.join(out,(option('--url')?'live-':'')+name+'.png'),fullPage});
 const routes=['/','/research/methods/','/research/','/research/reports/','/research/reports/20261101-static/','/research/reports/20261102-mapping/','/build/','/resources/','/en/','/404.html'];
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:960});
  for(const route of routes){
   const response=await page.goto(base+route);assert.equal(response.status(),200);
   await page.evaluate(()=>document.fonts.ready);await noOverflow(page);assert.equal(await page.locator('h1').count(),1);
   const images=await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';if(!i.complete){await new Promise(r=>{i.onload=r;i.onerror=r;});}return i.naturalWidth>0;})));assert(images.every(Boolean),'Broken images '+route);
   assert.equal(await page.locator('main').count(),1);assert.equal(await page.locator('.site-header').count(),1);
   if(['/','/resources/','/research/','/build/','/research/methods/'].includes(route))await shot(page,(route==='/'?'home':route.replaceAll('/','_'))+'-'+width,route==='/');
   if(route==='/')await shot(page,'home-viewport-'+width);
  }
 }
 record.checks.push('10 document pages at 1280/375: status, no overflow, headings, images, fonts');
 if(option('--url')){const response=await page.goto(base+'/__missing_page_for_qa__/');assert.equal(response.status(),404);assert.match(await page.locator('h1').innerText(),/ページが見つかりません/);record.checks.push('unknown route serves custom 404 with HTTP 404');}
 await page.goto(base+'/');await page.locator('.mobile-menu summary').click();assert(await page.locator('.mobile-menu nav').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('.mobile-menu nav').isVisible());assert(await page.locator('.mobile-menu summary').evaluate(e=>document.activeElement===e));
 await page.locator('.mobile-menu summary').click();await page.locator('.mobile-menu a[href="/resources/"]').click();assert(page.url().endsWith('/resources/'));
 const search=page.locator('#resource-search');await search.fill('GNSS');assert.match(await page.locator('#resource-count').innerText(),/^1 \/ 19/);await search.fill('no-such-resource-xyz');assert(await page.locator('#resource-empty').isVisible());await search.fill('');assert.equal(await page.locator('[data-resource]:visible').count(),19);
 await page.locator('.theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await shot(page,'resources-dark-375');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.locator('.theme-toggle').click();
  await page.goto(base+'/');await page.locator('.faq summary').first().click();assert(await page.locator('.faq details').first().getAttribute('open')!==null);await page.goto(base+'/');await page.keyboard.press('Tab');assert(await page.locator('.skip').evaluate(e=>document.activeElement===e&&getComputedStyle(e).outlineStyle!=='none'));
 record.checks.push('mobile menu navigation/Escape focus; search/empty/reset; theme persist; FAQ; keyboard focus');
 const phone=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2});phone.on('pageerror',e=>errors.push(String(e)));phone.setDefaultTimeout(20000);await phone.goto(base+'/map/');await phone.waitForFunction(()=>!document.querySelector('#map-canvas').hidden&&document.querySelector('#map-status').textContent.includes('写真面')&&!document.querySelector('#map-status').textContent.includes('読み込み'));await noOverflow(phone);
 const canvas=phone.locator('#map-canvas');await canvas.scrollIntoViewIfNeeded();const rect=await canvas.boundingBox();const cdp=await phone.context().newCDPSession(phone);const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});const pt=(id,x,y)=>({id,x,y,radiusX:8,radiusY:8,force:1});const settle=()=>phone.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 let before=await canvas.screenshot();const x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;await send('touchStart',[pt(1,x,y)]);await send('touchMove',[pt(1,x+45,y+20)]);await send('touchEnd',[]);await settle();assert.notDeepEqual(await canvas.screenshot(),before);
 const label=await canvas.getAttribute('aria-label');await send('touchStart',[pt(1,x-40,y),pt(2,x+40,y)]);await send('touchMove',[pt(1,x-60,y),pt(2,x+60,y)]);await send('touchEnd',[]);await settle();assert.notEqual(await canvas.getAttribute('aria-label'),label);
 before=await canvas.screenshot();await send('touchStart',[pt(1,x-40,y),pt(2,x+40,y)]);await send('touchMove',[pt(1,x-20,y+30),pt(2,x+60,y+30)]);await send('touchEnd',[]);await settle();assert.notDeepEqual(await canvas.screenshot(),before);
 await phone.locator('#fit-view').click();await phone.locator('#play').click();await phone.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='true');await phone.locator('#play').click();
 await phone.selectOption('#map-selection','20261101_nanyo_004');await phone.waitForFunction(()=>!document.querySelector('#no-map').hidden&&!document.querySelector('#timeline').hidden&&!document.querySelector('#map-status').textContent.includes('読み込み'));assert(await phone.locator('#timeline').isVisible());await phone.selectOption('#map-selection','20261101_nanyo_003');await phone.waitForFunction(()=>!document.querySelector('#map-view').disabled&&!document.querySelector('#map-canvas').hidden);
 await phone.waitForFunction(()=>!document.querySelector('#map-status').textContent.includes('読み込み'));await phone.evaluate(()=>scrollTo(0,0));await shot(phone,'map-mobile-touch',true);await shot(phone,'map-mobile-viewport');await phone.setViewportSize({width:812,height:375});await noOverflow(phone);await shot(phone,'map-landscape');await phone.close();
 record.checks.push('mobile emulation: real touch protocol rotate/pinch/pan, replay, excluded-map section, landscape');
 const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:375,height:900}});await nojs.goto(base+'/resources/');assert.equal(await nojs.locator('[data-resource]').count(),19);await nojs.locator('.mobile-menu summary').click();assert(await nojs.locator('.mobile-menu nav').isVisible());await noOverflow(nojs);await nojs.goto(base+'/map/');assert(await nojs.locator('noscript a').isVisible());await nojs.close();record.checks.push('no-JS content, navigation, all repositories, map report fallback');
 assert.deepEqual(errors,[]);record.passed=true;
}catch(error){record.passed=false;record.error=String(error.stack);process.exitCode=1;}finally{await finish(process.exitCode);console.log(JSON.stringify({passed:record.passed,checks:record.checks,error:record.error,browserExited:record.browserExited,serverClosed:record.serverClosed},null,2));}
