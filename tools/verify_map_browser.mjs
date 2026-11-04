// Real-browser QA using an existing Playwright and Edge installation. One browser,
// one ephemeral loopback server; owned processes are recorded and always closed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const args = process.argv.slice(2), option = key => args.includes(key) ? args[args.indexOf(key) + 1] : null;
assert(option('--playwright-root') && option('--browser-executable'), 'Pass --playwright-root and --browser-executable');
const root = process.cwd(), out = path.join(root, '.local/map-review'); fs.mkdirSync(out, {recursive: true});
const require = createRequire(path.join(path.resolve(option('--playwright-root')), 'package.json'));
const {chromium} = require('playwright');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
let server, browser, launch;
const record = {owner:'map-redesign', purpose:'public map interaction and visual verification', nodePid:process.pid, started:new Date().toISOString(), checks:[]};
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'site/map/manifest.json')));
try {
  let base = option('--url');
  if (!base) {
    const site = path.join(root, 'site');
    server = http.createServer((req, res) => {
      let file = path.resolve(site, `.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);
      if (!file.startsWith(site + path.sep) && file !== site) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  record.url = base;
  launch = await chromium.launchServer({headless:true, executablePath:option('--browser-executable')});
  record.browserPid = launch.process().pid; record.browserStarted = new Date().toISOString(); record.command = launch.process().spawnargs;
  fs.writeFileSync(path.join(out, 'process.json'), JSON.stringify(record, null, 2));
  browser = await chromium.connect(launch.wsEndpoint());
  const page = await browser.newPage({viewport:{width:1280,height:960}, reducedMotion:'reduce'});
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const ready = () => page.waitForFunction(() => !document.querySelector('#map-canvas').hidden && document.querySelector('#map-status').textContent.includes('写真面') && !document.querySelector('#map-status').textContent.includes('読み込み'));
  const screenshot = name => page.screenshot({path:path.join(out, `${option('--url') ? 'live-' : ''}${name}.png`),fullPage:true});
  const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
  const choose = async id => {await page.selectOption('#map-selection', id); await ready();};
  await page.goto(`${base}/map/`); await ready(); await noOverflow();
  await screenshot('desktop-1280'); record.checks.push('desktop default renders');
  const defaultItem = catalog.datasets.find(d => d.id === catalog.defaultSelection);
  const nav = JSON.parse(fs.readFileSync(path.join(root,'site/map',defaultItem.navigation.file)));
  const missing = nav.rows.find(r => r[2] === null), valid = nav.rows.find(r => r[1] && r[2]);
  async function setTime(t) {await page.locator('#time-number').fill(String(t)); await page.locator('#time-number').dispatchEvent('input');}
  await setTime(missing[0]); assert.match(await page.locator('#position-values .child').innerText(), /欠測/);
  await page.waitForFunction(() => !document.querySelector('.scene-label.marker.child'));
  await setTime(valid[0]); assert.match(await page.locator('#position-values .child').innerText(), new RegExp(valid[2][0].toFixed(2).replace('.','\\.')));
  assert.equal(Number(await page.locator('#time').inputValue()).toFixed(2), valid[0].toFixed(2));
  await page.locator('#time').fill('12.5'); await page.locator('#time').dispatchEvent('input'); assert.equal(await page.locator('#time-number').inputValue(),'12.50');
  record.checks.push('missing markers hidden; positions and both time inputs match source');
  await page.click('#play'); await page.waitForFunction(() => Number(document.querySelector('#time-number').value)>13); await page.click('#play');
  assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');
  await page.locator('#track-history').check(); await page.locator('#track-history').uncheck();
  for (const id of ['top-view','side-view','map-view','reset-view','fit-view']) {await page.click(`#${id}`); assert.equal(await page.locator(`#${id}`).getAttribute('aria-pressed'),'true');}
  await page.click('#map-view'); await screenshot('map-detail'); await page.click('#fit-view');
  for (const id of ['show-parent','show-child','show-photos','show-points','show-grid']) { const before = await page.locator(`#${id}`).isChecked(); await page.locator(`#${id}`).setChecked(!before); await page.locator(`#${id}`).setChecked(before); }
  const canvas=page.locator('#map-canvas'), area=await canvas.boundingBox();
  const before=await canvas.screenshot(); await page.mouse.move(area.x+area.width*.5,area.y+area.height*.5);await page.mouse.down();await page.mouse.move(area.x+area.width*.6,area.y+area.height*.55,{steps:5});await page.mouse.up();
  assert.notDeepEqual(await canvas.screenshot(),before);
  await canvas.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Shift+ArrowUp'); await page.keyboard.press('+'); await page.keyboard.press('0');
  const touch=await page.evaluate(async()=>{
    const c=document.querySelector('#map-canvas'), capture=c.setPointerCapture.bind(c);
    const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const dispatch=(type,id,x,y)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',bubbles:true}));
    c.setPointerCapture=()=>{};document.querySelector('#fit-view').click();await settle();const before=c.toDataURL();
    dispatch('pointerdown',1,100,100);dispatch('pointermove',1,150,120);dispatch('pointerup',1,150,120);await settle();const orbit=before!==c.toDataURL();
    dispatch('pointerdown',1,100,100);dispatch('pointerdown',2,200,100);dispatch('pointermove',2,250,100);await settle();const pinch=c.getAttribute('aria-label').includes('1.5 倍');
    dispatch('pointercancel',1,100,100);dispatch('pointercancel',2,250,100);const last=c.toDataURL();dispatch('pointermove',1,400,100);await settle();const cancelled=last===c.toDataURL();
    c.setPointerCapture=capture;return{orbit,pinch,cancelled};
  });assert.deepEqual(touch,{orbit:true,pinch:true,cancelled:true});record.checks.push('synthetic touch orbit/pinch/cancel (not a physical phone)');
  if(await page.locator('#fullscreen').isVisible()){await page.click('#fullscreen');await page.waitForFunction(()=>!!document.fullscreenElement);await page.click('#fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);}
  const downloadPromise=page.waitForEvent('download');await page.click('#save-image');const download=await downloadPromise;await download.saveAs(path.join(out,'export.png'));assert.ok(fs.statSync(path.join(out,'export.png')).size>10000);
  record.checks.push('play/pause/history, five views, five layers, mouse, keys, fullscreen, PNG');
  const states=[];
  for(const item of [...catalog.datasets,...catalog.groups]){await choose(item.id);states.push(await page.locator('#map-status').innerText());if(item.availability==='unavailable'){assert.equal(await page.locator('#timeline').isVisible(),true);assert.equal(await page.locator('#no-map').isVisible(),true);assert.equal(await page.locator('#map-view').isDisabled(),true);}if(item.ids)assert.equal(await page.locator('#timeline').isVisible(),false);}
  await page.evaluate(()=>{const s=document.querySelector('#map-selection');s.value='combined';s.dispatchEvent(new Event('change'));s.value='20261101_nanyo_003';s.dispatchEvent(new Event('change'));});await ready();assert.match(await page.locator('#map-status').innerText(),/11\/1 区間3/);
  record.checks.push('all seven experiments and three groups; cancellation');record.selections=states;
  await setTime(100);await page.click('#side-view');await page.reload();await ready();assert.equal(await page.locator('#time-number').inputValue(),'100.00');assert.equal(await page.locator('#side-view').getAttribute('aria-pressed'),'true');
  record.checks.push('URL restores selection/time/view');
  await page.click('#fit-view');
  for(const width of [375,760,640]){await page.setViewportSize({width,height:900});await noOverflow();await screenshot(`responsive-${width}`);if(width===375){const p=page.waitForEvent('download');await page.click('#save-image');await(await p).saveAs(path.join(out,'mobile-export.png'));const bytes=fs.readFileSync(path.join(out,'mobile-export.png'));assert.ok(bytes.readUInt32BE(16)>=1599);}}
  await page.setViewportSize({width:1280,height:960});await choose('20261101_nanyo_004');await screenshot('unavailable-map');
  await page.goto(base+'/');await noOverflow();await screenshot('home-1280');
  await page.setViewportSize({width:375,height:900});await noOverflow();await screenshot('home-375');
  await page.keyboard.press('Control+Home');await page.keyboard.press('Tab');assert.ok(await page.locator('.skip').evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
  record.checks.push('375/640/760/1280 layout, home links, keyboard focus');
  assert.deepEqual(errors,[]);
  if(!option('--url')) {
    const failure=await browser.newPage({viewport:{width:1280,height:900}});failure.setDefaultTimeout(20000);
    await failure.route('**/*-navigation.json*',r=>r.fulfill({status:503,body:'Intentional QA failure'}));
    await failure.goto(`${base}/map/`);await failure.waitForFunction(()=>!document.querySelector('#retry-map').hidden);assert.equal(await failure.locator('#map-canvas').isVisible(),false);
    await failure.unroute('**/*-navigation.json*');await failure.click('#retry-map');await failure.waitForFunction(()=>!document.querySelector('#map-canvas').hidden);
    await failure.evaluate(()=>document.querySelector('#map-canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
    await failure.waitForFunction(()=>document.querySelector('#map-status').textContent.includes('中断'));await failure.close();record.checks.push('network failure/retry and WebGL loss');
  }
  record.passed=true;
} catch(error) {record.passed=false;record.error=String(error.stack);process.exitCode=1;}
finally {
  await browser?.close();await launch?.close();if(server)await new Promise(resolve=>server.close(resolve));
  record.finished=new Date().toISOString();record.browserExited=launch?.process().exitCode!==null;record.serverClosed=!server?.listening;
  fs.writeFileSync(path.join(out,option('--url')?'live-verification.json':'verification.json'),JSON.stringify(record,null,2));
  fs.writeFileSync(path.join(out,'process.json'),JSON.stringify(record,null,2));
  console.log(JSON.stringify(record,null,2));
}
