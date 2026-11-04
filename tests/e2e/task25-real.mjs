// No data interception, no fixtures: official artifacts + live DEV/Preview climate API.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK25_BASE_URL||'http://127.0.0.1:3023';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost'].includes(origin.hostname)||/^agriclimax-[a-z0-9-]+\.vercel\.app$/.test(origin.hostname));
const destination=process.env.TASK25_ARTIFACTS||'docs/codex/task25';
await mkdir(`${destination}/screenshots`,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={base,mocked:false,realDataVerified:false,viewports:[],apiProofs:{},errors:[],cases:[]};
try {
 const headers=origin.hostname.endsWith('.vercel.app')&&process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'fr-FR',reducedMotion:'reduce',extraHTTPHeaders:headers});
 page.on('pageerror',e=>report.errors.push(e.message));
 async function api(query){const r=await page.request.get(`${base}/api/agriculture?${query}`);assert.equal(r.status(),200);return r.json();}
 const catalog=await api('action=catalog');assert.ok(catalog.indicators.length>=496);
 const saa=await api('action=dataset&indicator=saa-cop-03-surf-departement');
 const s77=saa.rows.find(r=>r.code==='77');assert.equal(s77.values.at(-1),117468);
 assert.equal(saa.rows.find(r=>r.code==='2A').values.at(-1),2);
 assert.equal(saa.rows.reduce((n,r)=>n+(r.values.at(-1)??0),0),4494355);
 const rpg=await api('action=dataset&indicator=rpg-group-1-surf-pra');
 const agriculturalPra=rpg.rows.filter(r=>r.code.startsWith('77')&&r.values[0]>0).sort((a,b)=>b.values[0]-a.values[0])[0];assert.ok(agriculturalPra);
 const pra=`pra:${agriculturalPra.code}`;
 const wheat=await api(`action=wheat-context&pra=${encodeURIComponent(pra)}`);
 assert.equal(wheat.data.area_ha,agriculturalPra.values[0]);
 assert.equal(wheat.year,2025);
 const fmt=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
 report.apiProofs={saaSha:saa.indicator.sha256,wheatFrance2025:4494355,seineEtMarne2025:117468,corsica2A2025:2,rpgPra:pra,rpgAreaHa:agriculturalPra.values[0],rpgRegions:wheat.source.completed_regions,rpgCoverage:wheat.source.coverage};
 const climateResponse=await page.request.get(`${base}/api/unified?start=2026-10-15&end=2026-10-15&indicator=temperature&threshold=25`);
 assert.equal(climateResponse.status(),200,'Live DEV/Preview climate required');
 const climate=await climateResponse.json();assert.equal(climate.data.length,713);
 report.apiProofs.climateRows=climate.data.length;
 report.apiProofs.climateUnavailable=climate.data.filter(r=>r.status==='unavailable').length;
 const recipes=[
  ['climat',`/?pra=${encodeURIComponent(pra)}&date=2026-10-15&periode=jour`,713],
  ['saa-departement','/productions?territoire=dep%3A77&agri_production=saa-cop-03&annee=2025',96],
  ['rpg',`/productions?agri_production=rpg-group-1&territoire=${encodeURIComponent(pra)}&pra=${encodeURIComponent(pra)}`,713],
  ['analyse',`/analyse?pra=${encodeURIComponent(pra)}&date=2026-10-15&start=2026-10-15&periode=jour`,713],
 ];
 for(const [size,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  for(const [space,url,count] of recipes){
   await page.goto(base+url,{waitUntil:'networkidle'});
   await page.locator(`.national-map[data-ready="true"][data-feature-count="${count}"]`).waitFor({timeout:60000});
   if(space==='saa-departement')await page.locator('.unified-value strong').filter({hasText:fmt(117468)}).waitFor();
   if(space==='rpg')await page.locator('.unified-value strong').filter({hasText:fmt(agriculturalPra.values[0])}).waitFor();
   if(['climat','analyse'].includes(space))await page.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:60000});
   if(space==='analyse'){
    await page.getByRole('heading',{name:'B. Contexte agricole · blé tendre'}).waitFor();
    await page.getByText('de blé tendre déclarés en 2025',{exact:false}).waitFor();
    assert.match(await page.locator('.unified-panel').innerText(),/2025 \/ 2026/);
   }
   assert.equal(await page.getByRole('link',{name:'Productions agricoles',exact:true}).count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${space} ${width}: overflow`);
   assert.equal(await page.getByText('Carte indisponible.',{exact:false}).count(),0);
   const screenshot=`screenshots/${space}-${size}.png`;await page.screenshot({path:`${destination}/${screenshot}`,fullPage:true});
   report.viewports.push({space,size,width,height,featureCount:count,screenshot});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 const regional=catalog.indicators.find(i=>i.sheet==='EFV'&&i.variable==='EFF'&&i.scale==='region');assert.ok(regional);
 await page.goto(`${base}/productions?agri_production=${regional.production}&territoire=reg%3A53`,{waitUntil:'networkidle'});
 await page.locator('.national-map[data-ready="true"][data-feature-count="13"]').waitFor();
 assert.equal(await page.getByRole('combobox',{name:'Maille publiée'}).locator('option').count(),1);
 assert.match(await page.locator('.unified-map-title').innerText(),/milliers de têtes/);
 await page.screenshot({path:`${destination}/screenshots/saa-region-desktop.png`,fullPage:true});
 report.cases.push('Regional-only poultry remains regional, source unit preserved');
 await page.goto(base+recipes[0][1],{waitUntil:'networkidle'});await page.locator('.national-map[data-ready="true"]').waitFor();
 const original=await page.locator('.maplibregl-canvas').elementHandle();
 for(const label of ['Productions agricoles','Analyse agroclimato','Climat']){
  await page.getByRole('link',{name:label,exact:true}).click();
  await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).searchParams.get('pra'),pra);
  assert.equal(await original.evaluate(node=>node===document.querySelector('.maplibregl-canvas')),true);
 }
 report.cases.push('Same canvas and PRA context across all three spaces');
 await page.goto(base+'/productions?agri_production=saa-cop-03&territoire=dep%3A77&annee=2010',{waitUntil:'networkidle'});
 await page.locator('.unified-value strong').filter({hasText:fmt(s77.values[0])}).waitFor();
 await page.reload({waitUntil:'networkidle'});assert.equal(new URL(page.url()).searchParams.get('annee'),'2010');
 report.cases.push('Native 2010 value, URL and reload');
 for(const path of ['/stations?mode=live_meteofrance&production=wheat','/stations?mode=live_meteofrance&production=cattle&indicator=thi']){
  const response=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 }
 report.cases.push('Historical wheat and station THI routes remain accessible');
 assert.deepEqual(report.errors,[]);report.realDataVerified=true;
 await writeFile(`${destination}/browser-real.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally {await browser.close();}
