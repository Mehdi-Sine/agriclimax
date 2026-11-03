import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base=process.env.TASK24_BASE_URL || 'http://127.0.0.1:3020';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Local browser test only');
const directory='docs/codex/task24/screenshots';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={realDataVerified:false,mocked:false,viewports:[],errors:[],requests:[]};
try{
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce',locale:'fr-FR'});
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',async r=>{if(r.url().startsWith(base))report.requests.push({path:new URL(r.url()).pathname,status:r.status(),bytes:(await r.body().catch(()=>Buffer.alloc(0))).length});});
for(const [size,width,height] of [['desktop',1440,900],['tablet',768,1000],['mobile',390,844]]){
 await page.setViewportSize({width,height});
 for(const [space,path] of [['climat','/'],['productions','/productions'],['analyse','/analyse']]){
  const mark=performance.now();
  await page.goto(base+path+'?pra=pra%3A28341&date=2026-10-15',{waitUntil:'networkidle'});
  await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
  assert.equal(await page.getByText('Carte indisponible.',{exact:false}).count(),0);
  const mapReadyMs=Math.round(performance.now()-mark);
  // Wait for the source to resolve or its explicit error state, with no intercepted requests.
  if(space!=='productions')await page.locator('.unified-source-state').filter({hasText:/PRA complètes|inaccessible|activée/}).waitFor({timeout:30000});
  assert.equal(await page.locator('[aria-label="Espaces produit"] a').count(),3);
  assert.equal(await page.locator('.national-map').getAttribute('data-feature-count'),'713');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${space} ${width}: overflow`);
  const name=`${space}-${size}.png`;await page.screenshot({path:`${directory}/${name}`,fullPage:true});
  report.viewports.push({space,size,width,height,mapReadyMs,resources:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/maps/')||r.name.includes('/api/')).map(r=>({path:new URL(r.name).pathname,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize,durationMs:Math.round(r.duration)}))),screenshot:name,source:space==='productions'?'Agriculture non connectée':await page.locator('.unified-source-state').innerText()});
 }
}
await page.setViewportSize({width:1440,height:900});
await page.goto(base+'/?pra=pra%3A01451&date=2026-10-15',{waitUntil:'networkidle'});
await page.locator('.national-map[data-ready="true"]').waitFor();
await page.getByRole('link',{name:'Productions agricoles',exact:true}).click();await page.waitForURL('**/productions?**');assert.match(page.url(),/pra=pra%3A01451/);
await page.getByRole('link',{name:'Analyse agroclimato',exact:true}).click();await page.waitForURL('**/analyse?**');assert.match(page.url(),/pra=pra%3A01451/);
await page.goBack();await page.waitForURL('**/productions?**');assert.match(page.url(),/productions/);
await page.reload();await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});assert.match(await page.locator('.unified-panel').innerText(),/01451/);
await page.goto(base+'/territories?date=2026-10-15&pra=pra%3A01451');await page.waitForURL(url=>url.pathname==='/');assert.equal(new URL(page.url()).pathname,'/');assert.match(page.url(),/2026-10-15/);
await page.goto(base+'/?date=2026-11-03');assert.match(await page.getByRole('alert').first().innerText(),/hors de l’archive/);
assert.deepEqual(report.errors,[]);
await writeFile('docs/codex/task24/browser-real.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.viewports));
}finally{await browser.close();}
