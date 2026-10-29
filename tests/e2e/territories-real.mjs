// Real official-PRA/CDS data staged in disposable local PostGIS; no mock responses.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const web=createRequire(path.resolve('apps/web/package.json'));
const lint=createRequire(web.resolve('eslint-config-next'));
const axe=createRequire(lint.resolve('eslint-plugin-jsx-a11y'));
const base=process.env.PRA_REAL_BASE_URL||'http://127.0.0.1:3019';
assert.equal(new URL(base).hostname,'127.0.0.1');
const reference='ofb-masa-pra-2017-snapshot-20261017',dataset='task19-ofb-pilot-cds-20261017';
const root=process.env.PRA_REAL_ROOT||'work/task19/official';
const report=JSON.parse(await readFile(`${root}/pilot-evidence.json`,'utf8'));
const dir=`${root}/browser`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
try {
 const page=await browser.newPage();
 const ids=[];let after='';
 do {
  const response=await page.request.get(`${base}/api/territories?${new URLSearchParams({reference,action:'lookup',limit:'100',after})}`);
  assert.equal(response.status(),200);const body=await response.json();ids.push(...body.data.map(r=>r.id));after=body.next_cursor;
 } while(after);
 assert.equal(ids.length,713);assert.equal(new Set(ids).size,713);assert.ok(!ids.includes('pra:75000'));
 for(const row of report.cases) {
  const selection=new URLSearchParams({action:'read',reference,dataset,date:'2026-10-07',scope:'pra',id:row.pra_id});
  const response=await page.request.get(`${base}/api/territories?${selection}`);assert.equal(response.status(),200);
  const body=await response.json(),actual=body.data[0],expected=row.daily.at(-1);
  assert.equal(actual.id,row.pra_id);assert.equal(actual.expected_cells,expected.expected_cells);assert.equal(actual.status,expected.valid_counts.every(v=>v===0)?'unavailable':expected.status);
  assert.equal(actual.freshness,'stale');assert.equal(body.source_kind,'reanalysis');
  for(const key of ['temperature','temperature_min','temperature_max','precipitation']) {
   if(expected[key]===null)assert.equal(actual[key],null);else assert.ok(Math.abs(actual[key]-expected[key])<0.0001);
  }
  const diagnostics=await page.request.get(`${base}/api/territories/diagnostics?${new URLSearchParams({reference,dataset,pra:row.pra_id,start:'2026-10-01',end:'2026-10-07',parameters:report.parameters_sha256})}`);
  assert.equal(diagnostics.status(),200);const diag=await diagnostics.json();assert.equal(diag.risk_computed,false);assert.equal(diag.data.length,8);assert.equal(diag.scientific_status,'exploratory');
  assert.ok(diag.data.every(r=>r.data_freshness==='stale'));
  const absent=await page.request.get(`${base}/api/territories?${new URLSearchParams({...Object.fromEntries(selection),date:'2026-09-30'})}`);
  assert.equal((await absent.json()).data[0].status,'unavailable');
  for(const width of [1440,768,390]) {
   await page.setViewportSize({width,height:900});
   const url=`${base}/territories?${new URLSearchParams({reference,dataset,date:'2026-10-07',pra:row.pra_id,department:row.pra_id.slice(4,6)})}`;
   await page.goto(url,{waitUntil:'networkidle'});const text=await page.locator('main').innerText();
   assert.ok(text.includes(row.name));assert.ok(text.includes('ERA5-Land'));assert.ok(text.includes('stale'));if(row.pra_id==='pra:2B260')assert.ok(text.includes('99,9839'));if(row.pra_id==='pra:29102')assert.ok(text.includes('Disponibilité : unavailable'));
   assert.ok(!text.includes('Données territoriales indisponibles'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const html=await page.content();assert.ok(!html.includes('demo-fiction'));assert.ok(!html.includes('data-demo="true"'));
   assert.ok(!html.includes('source_receipts'));assert.ok(!html.includes('"coordinates":'));
   await page.addScriptTag({path:axe.resolve('axe-core/axe.min.js')});
   const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
   assert.deepEqual(violations.map(v=>v.id),[]);
   await page.screenshot({path:`${dir}/${row.pra_id.replace(':','-')}-${width}.png`,fullPage:true});
   results.push({pra_id:row.pra_id,width,axe:0,no_overflow:true,real_values_match:true,stale:true,source:'era5-land'});
  }
 }
 await page.getByLabel('Rechercher une PRA',{exact:true}).fill('Montagne');
 await page.getByRole('button',{name:'Rechercher',exact:true}).click();await page.waitForLoadState('networkidle');
 assert.equal(new URL(page.url()).searchParams.get('q'),'Montagne');await page.goBack({waitUntil:'networkidle'});
 assert.equal(new URL(page.url()).searchParams.get('pra'),'pra:2B260');
 const href=await page.getByRole('link',{name:'Carte et diagnostic live · stations Météo-France',exact:true}).getAttribute('href');
 assert.equal(new URL(href,base).searchParams.get('mode'),'live_meteofrance');
 await writeFile(`${dir}/report.json`,JSON.stringify({local_real_postgis:true,production_supabase_tested:false,reference,dataset,lookup_count:ids.length,results},null,2));
 console.log('Official PRA, real CDS, API projection, missing publication, freshness, responsive and AA checks passed.');
} finally {await browser.close();}
