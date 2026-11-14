import assert from 'node:assert/strict';
import {X509Certificate,createHash as hashCertificate} from 'node:crypto';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import path from 'node:path';
import {chromium} from './node_modules/playwright/index.mjs';
const base=process.env.BASE_URL??'http://localhost:3001',out=process.env.EVIDENCE_DIR??'work/edit-04/browser';
await mkdir(out,{recursive:true});
const require=createRequire(path.resolve('apps/web/package.json'));
const axePath=createRequire(createRequire(require.resolve('eslint-config-next')).resolve('eslint-plugin-jsx-a11y')).resolve('axe-core/axe.min.js');
// Scope Chromium's additional trust to the environment's configured proxy CA.
const proxyCertificate=process.env.NODE_EXTRA_CA_CERTS?new X509Certificate(await readFile(process.env.NODE_EXTRA_CA_CERTS)):null;
const proxyTrust=proxyCertificate?[`--ignore-certificate-errors-spki-list=${hashCertificate('sha256').update(proxyCertificate.publicKey.export({type:'spki',format:'der'})).digest('base64')}`]:[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader',...proxyTrust],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}}:{})});
const report={base,editions:[],states:[],errors:[]};
try{
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:label==='mobile',isMobile:label==='mobile',reducedMotion:'reduce',extraHTTPHeaders:process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const date of ['2026-11-12','2026-11-13','2026-11-14']){
   const fixture=JSON.parse(gunzipSync(await readFile(`fixtures/editorial/${date==='2026-11-14'?'edit04':'edit03'}/${date}.json.gz`))), edition=fixture.archive,comparison=JSON.parse(await readFile(`work/edit-04/results/${date}.json`)),expected=comparison.after.order.map(id=>fixture.bundle.maps.find(m=>m.id===id));
   const requests=[];const listener=r=>requests.push(r.url());page.on('request',listener);
   const started=Date.now(),response=await page.goto(`${base}/?date=${date}`,{waitUntil:'domcontentloaded',timeout:90000});
   assert.equal(response.status(),200);assert.equal(response.request().redirectedFrom(),null);
   const cards=page.locator('.journal-map-card'),carousel=page.locator('.journal-map-carousel'),track=page.locator('.journal-carousel-track');
   await cards.first().waitFor();assert.equal(await cards.count(),6);
   await page.waitForFunction(()=>document.querySelectorAll('.journal-thumbnail[data-state=ready]').length===6,{},{timeout:90000});
   const loadedMs=Date.now()-started;
   assert.equal(await page.locator('.maplibregl-canvas').count(),0);
   assert.equal(requests.filter(u=>/\/api\/journal\/(maps|edition-map)\?/.test(u)).length,0);
   assert.equal(requests.filter(u=>/maplibre.*(\.js|\.geojson)|journal-pra-v1\.geojson/.test(u)).length,0);
   assert.equal(await page.locator('.ux01-edition-meta').innerText().then(s=>s.includes(`${date.slice(-2)} NOVEMBRE`)),true);
   assert.match(await page.locator('body').innerText(),/Édition expérimentale/);
   assert.ok(await page.locator('#edition-date').count());
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,afterDeck:document.querySelector('.hero-copy').nextElementSibling.classList.contains('journal-map-carousel')}));
   assert.equal(layout.overflow,false);assert.equal(layout.afterDeck,true);
   const links=[];const legends=[];
   for(let i=0;i<expected.length;i++){
    const card=cards.nth(i),m=expected[i];
    assert.equal(await card.getAttribute('data-map-id'),m.id);
    const href=await card.locator('a').getAttribute('href'),u=new URL(href,base);links.push(href);
    assert.equal(u.searchParams.get('date'),date);assert.equal(u.searchParams.get('id'),edition.edition_id);assert.equal(u.searchParams.get('map'),m.id);
    assert.equal(await card.locator('h3').innerText(),m.title);
    assert.ok((await card.innerText()).includes(m.period.join(' → ')));
    assert.ok((await card.innerText()).includes(m.nature==='forecast'?'PRÉVISION':'HISTORIQUE'));
    legends.push(await card.locator('.journal-card-ramp span').allTextContents());
   }
   await carousel.scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'Cartes suivantes',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.journal-carousel-track').scrollLeft>50);
   await cards.first().locator('a').focus();await page.keyboard.press('End');assert.equal(await page.locator(':focus').getAttribute('href'),links[5]);
   await page.keyboard.press('Home');assert.equal(await page.locator(':focus').getAttribute('href'),links[0]);
   await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('href'),links[1]);await page.keyboard.press('Home');
   if(label==='mobile'){
    const box=await track.boundingBox(),session=await context.newCDPSession(page),y=Math.min(box.y+100,height-80),x=width-35;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let n=1;n<=8;n++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-n*30,y}]});await page.waitForTimeout(20);}
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>document.querySelector('.journal-carousel-track').scrollLeft>80);
    await session.detach();await cards.first().locator('a').focus();await page.keyboard.press('Home');
   }
   await track.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
   await page.waitForTimeout(500);
   await track.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
   await page.evaluate(()=>document.activeElement instanceof HTMLElement&&document.activeElement.blur());
   await page.addScriptTag({path:axePath});
   const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
   await page.screenshot({path:`${out}/${date}-${label}-journal.png`,fullPage:true});
   await carousel.screenshot({path:`${out}/${date}-${label}-carousel.png`});
   page.off('request',listener);
   let thumbnailBytes=0;const sizes=[];
   for(const m of expected){const r=await context.request.get(`${base}/api/journal/thumbnail?id=${edition.edition_id}&map=${m.id}&v=ux03-1`);assert.equal(r.status(),200);assert.equal(r.headers()['content-type'],'image/webp');assert.equal(r.headers()['cache-control'],'no-store');const size=(await r.body()).length;sizes.push(size);thumbnailBytes+=size;}
   // Visit every deep link, verifying the selected indicator, validity and legend.
   for(let i=0;i<expected.length;i++){
    const m=expected[i];console.log(`${date} ${label}: checking interactive ${i+1}/6`);await page.goto(base+links[i],{waitUntil:'domcontentloaded',timeout:90000});
    await page.locator('.national-map[data-ready=true]').waitFor({timeout:90000});
    assert.equal(await page.getByRole('combobox',{name:'Indicateur de l’édition',exact:true}).inputValue(),m.id);
    assert.equal(await page.locator('.journal-pra-map').getAttribute('data-map-id'),m.id);
    assert.equal(await page.locator('.journal-pra-map figcaption h2').innerText(),m.title);
    assert.deepEqual(await page.locator('.semantic-legend .legend-ramp small').allTextContents(),legends[i]);
    const payload=await context.request.get(`${base}/api/journal/maps?id=${edition.edition_id}&map=${m.id}`).then(r=>r.json());
    assert.deepEqual(payload.map,m);assert.equal(payload.bundle_sha256,fixture.bundle.sha256);
    if(i===5)await page.screenshot({path:`${out}/${date}-${label}-interactive.png`,fullPage:true});
   }
   report.editions.push({date,label,loadedMs,cards:6,deepLinksChecked:6,thumbnailBytes,sizes,layout,violations});
   console.log(`${date} ${label}: 6 selected real maps, links, dates, legend, keyboard${label==='mobile'?', native swipe':''}; ${thumbnailBytes} bytes`);
  }
  // Loading and failure must preserve titles, legends and working anchors.
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/journal/thumbnail?**',async route=>{await gate;await route.abort();});
  await page.goto(`${base}/?date=2026-11-13`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.journal-thumbnail[data-state=loading]').first().waitFor();
  await page.locator('.journal-map-carousel').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/${label}-loading.png`,fullPage:true});
  release();await page.waitForFunction(()=>document.querySelectorAll('.journal-thumbnail[data-state=error]').length===6);
  assert.equal(await page.locator('.journal-map-card-link').count(),6);await page.screenshot({path:`${out}/${label}-missing-thumbnails.png`,fullPage:true});
  await page.unroute('**/api/journal/thumbnail?**');
  await page.goto(`${base}/journal?date=2026-10-01`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('heading',{name:'Aucune édition archivée à cette date'}).waitFor();assert.equal(await page.locator('.journal-map-card').count(),0);
  report.states.push({label,loading:true,missingThumbnail:true,missingEdition:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.ok(report.editions.every(e=>e.violations.length===0),'Accessibility violations: see report');
}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
