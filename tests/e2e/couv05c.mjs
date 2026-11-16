// Isolated responsive component replay with actual native archive values.
// Never publishes an edition or calls a weather supplier or OpenAI.
import {chromium} from 'playwright';
import {mkdir,copyFile,rm,access,writeFile} from 'node:fs/promises';
import {openSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
const route='apps/web/app/couv05c-preview',out='work/couv05c-browser',port=3015;
try{await access(route);throw Error('Preserve existing preview route');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(route,{recursive:true});await mkdir(out,{recursive:true});
let server,browser;const report=[];
try{
 for(const f of ['page.tsx','preview.tsx'])await copyFile('tests/e2e/fixtures/couv05c-preview/'+f,route+'/'+f);
 const prepared=spawnSync(process.execPath,['features/observation/prepare-worker.mjs'],{cwd:'apps/web'});if(prepared.status!==0)throw Error('Map worker preparation failed');
 const log=openSync(out+'/server.log','w');
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{cwd:'apps/web',env:{...process.env,NEXT_PUBLIC_COUV04_RENDER_ENABLED:'true',COUV05_RENDER_ENABLED:'false'},detached:true,stdio:['ignore',log,log]});
 for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/couv05c-preview`)).ok)break;}catch{}if(i===59)throw Error('Preview unavailable');await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Local page supplies exact replay payloads; published API routes are not used.
  await page.route('**/api/journal/maps?*',async route=>{
   const data=await page.locator('#replay-data').textContent();const parsed=JSON.parse(data);
   const mapId=new URL(route.request().url()).searchParams.get('map'),sample=parsed.samples.find(s=>s.map.id===mapId);
   await route.fulfill({json:{map:sample.map,bundle_sha256:parsed.view.bundle_sha256,forecast_rendering:{collection:sample.collection,qualities:Object.fromEntries(sample.map.rows.map(r=>[r.territoryId,r.quality]))}}});
  });
  // Raster thumbnail assertions use the server renderer in the real replay test;
  // this browser exercise verifies carousel responsiveness and keyboard behavior.
  await page.route('**/api/journal/thumbnail?*',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><text x="10" y="30">Miniature contrôlée séparément sur archive réelle</text></svg>'}));
  await page.goto(`http://127.0.0.1:${port}/couv05c-preview`,{waitUntil:'networkidle'});
  for(const index of [0,1,2]){
   await page.getByLabel('Recette du rejeu',{exact:true}).selectOption(String(index));
   for(const map of await page.getByLabel('Indicateur de l’édition',{exact:true}).all())await map.selectOption({index});
   await page.locator('.national-map[data-ready="true"]').nth(2).waitFor({timeout:60000});
   await page.waitForTimeout(500);
   const contours=await page.locator('.national-map').evaluateAll(es=>es.map(e=>e.dataset.renderedContourCount));
   if(contours.length!==3||contours.some(n=>n!=='713'))throw Error('Missing PRA outline');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow){await page.screenshot({path:out+'/overflow.png',fullPage:true});await writeFile(out+'/overflow.json',JSON.stringify(await page.locator('body *').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,20).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,text:e.textContent?.slice(0,100)}))),null,2));throw Error('Horizontal overflow');}
   if(errors.length)throw Error(errors.join('; '));
   await page.screenshot({path:`${out}/${width}-${index}.png`,fullPage:true});report.push({width,recipe:index,contours,overflow,errors});
  }
  const first=page.locator('.journal-map-card-link').first();await first.focus();await page.keyboard.press('ArrowRight');
  if(await page.locator('.journal-map-card-link').nth(1).evaluate(e=>e!==document.activeElement))throw Error('Carousel keyboard');
  await page.close();
 }
}finally{
 await browser?.close();if(server?.pid)process.kill(-server.pid,'SIGTERM');await rm(route,{recursive:true,force:true});
 await writeFile(out+'/browser.json',JSON.stringify({kind:'real archive / isolated shared components; full product flows not certified',checks:report},null,2));
}
