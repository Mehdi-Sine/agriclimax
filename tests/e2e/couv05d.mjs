// Full product pages and real server API/Storage. No response injection or thumbnail substitution.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.COUV05D_BASE??'http://127.0.0.1:3015',mode=process.env.COUV05D_MODE??'on';
const out=`work/couv05d-browser/${mode}`;await mkdir(out,{recursive:true});
const prepared=JSON.parse(await readFile('work/couv05d-preview/report.json','utf8'));
const bundle=JSON.parse(await readFile(`work/couv05d-preview/${prepared.edition_id}.json`,'utf8'));
const rain=bundle.maps.find(m=>m.nature==='forecast'&&m.indicator==='rain');
const edition=`id=${prepared.edition_id}&date=2026-11-15`,run=process.env.COUV05D_RUN??'2026-11-14T18:00:00+00:00';
const weather=(model,variable,cycle=run)=>new URLSearchParams({temporal:'forecast',weather_model:model,weather_variable:variable,weather_run:cycle,forecast_date:new Date(Date.parse(cycle)+86400000).toISOString().slice(0,10)});
const cases=[
 ['analyse-pluie-homogene','/analyse?'+new URLSearchParams({temporal:'forecast',weather_run:run,agro:'rain',agro_start:'2026-11-16',agro_end:'2026-11-17'})],
 ['analyse-thi-homogene','/analyse?'+new URLSearchParams({temporal:'forecast',weather_run:run,production:'cattle',agro:'thi',agro_start:'2026-11-19',agro_end:'2026-11-21'})],
 ['climat-pluie-ifs-partiel','/climat?'+new URLSearchParams({...Object.fromEntries(weather('ifs','precipitation')),forecast_date:'2026-11-19'})],
 ['climat-cycle-precedent','/climat?'+weather('selected','temperature','2026-11-13T18:00:00+00:00')],
 ['climat-cycle-suivant','/climat?'+weather('selected','temperature','2026-11-15T18:00:00+00:00')],
 ['climat-temperature','/climat?'+weather('selected','temperature')],
 ['climat-pluie-ifs','/climat?'+weather('ifs','precipitation')],
 ['climat-humidite-ifs','/climat?'+weather('ifs','humidity')],
 ['analyse-pluie-multi-modeles','/analyse?'+new URLSearchParams({temporal:'forecast',weather_run:run,agro:'rain',agro_start:'2026-11-15',agro_end:'2026-11-21'})],
 ['analyse-thi-multi-modeles','/analyse?'+new URLSearchParams({temporal:'forecast',weather_run:run,production:'cattle',agro:'thi',agro_start:'2026-11-15',agro_end:'2026-11-21'})],
 ['cartes-du-jour',`/cartes-du-jour?${edition}&map=${rain.id}`],
 ['journal',`/journal?${edition}`],
];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const checks=[],failures=[];
try{
 for(const width of (process.env.COUV05D_WIDTHS?process.env.COUV05D_WIDTHS.split(',').map(Number):mode==='on'?[1440,768,390]:[1440,390])){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async response=>{
   const url=new URL(response.url());if(!url.pathname.startsWith('/api/'))return;
   const entry={path:url.pathname,query:url.search,status:response.status(),bytes:0};responses.push(entry);
   try{const bytes=await response.body();entry.bytes=bytes.length;entry.sha256=createHash('sha256').update(bytes).digest('hex');
    if(url.pathname==='/api/journal/thumbnail'){entry.content_type=response.headers()['content-type'];entry.real_thumbnail=true;return;}
    const d=JSON.parse(bytes.toString());
    if(d.rows){entry.rows=d.rows.length;entry.corsica=d.rows.filter(r=>/^pra:2[AB]/.test(r.pra_id)).length;entry.run=d.run;entry.dates=[...new Set(d.rows.map(r=>r.valid_date))];entry.sources=[...new Set(d.rows.map(r=>r.source_id))];entry.archive_sha256=d.archive_sha256;
      if(d.coverage_quality){entry.paint={whole:0,covered:0,unavailable:0};for(const r of d.rows){const q=d.coverage_quality.definitions[d.coverage_quality.lookup[`${r.pra_id}/${r.valid_date}/${r.variable}`]];entry.paint[!q?.indicator_eligible||r.value===null?'unavailable':q.evidence.fraction>=.9?'whole':'covered']++;}}}
    if(d.data){entry.paint={whole:0,covered:0,unavailable:0};for(const r of d.data)entry.paint[!r.quality?.indicator_eligible||(r.value??r.observed_value??null)===null?'unavailable':r.quality.evidence.fraction>=.9?'whole':'covered']++;entry.rows=d.data.length;entry.eligible=d.data.filter(r=>r.quality?.indicator_eligible).length;entry.rule=d.rule?.id;}
    if(d.forecast_rendering){entry.eligible=Object.values(d.forecast_rendering.qualities).filter(q=>q.indicator_eligible).length;}
   }catch{/* response interruption is recorded by status; do not fabricate content */}
  });
  for(const [name,path] of cases.filter(([name])=>!process.env.COUV05D_CASE||new RegExp(process.env.COUV05D_CASE).test(name))){
   const began=performance.now(),first=responses.length,priorErrors=errors.length;
   const record={name,width,mode,url:path};
   try{
    let apiReady=name==='journal'?null:page.waitForResponse(response=>{const u=new URL(response.url());return name.startsWith('climat')?u.pathname==='/api/operational'&&u.searchParams.has('date'):name.startsWith('analyse')?u.pathname==='/api/agroclimatic':u.pathname==='/api/journal/maps'&&u.searchParams.get('map')===rain.id;},{timeout:90000});apiReady?.catch(()=>{});
    const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(response.status(),200);
    if(name==='journal'){
     const links=page.locator('.journal-map-card-link');await links.first().waitFor({timeout:90000});assert.ok(await links.count()>1);
     const imgs=page.locator('.journal-map-card img');
     for(const img of await imgs.all()){await img.scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle(),{timeout:60000});}
     record.thumbnails=await imgs.evaluateAll(es=>es.map(e=>({loaded:e.complete&&e.naturalWidth>0,src:e.getAttribute('src')})));assert.ok(record.thumbnails.every(i=>i.loaded));
     await links.first().focus();await page.keyboard.press('ArrowRight');assert.ok(await links.nth(1).evaluate(e=>e===document.activeElement));
     await page.screenshot({path:`${out}/${width}-journal-page.png`,fullPage:true});
     record.journal_inline_map=false;record.journal_path='real carousel -> real interactive Cartes du jour';
     apiReady=page.waitForResponse(response=>{const u=new URL(response.url());return u.pathname==='/api/journal/maps'&&u.searchParams.get('map')===rain.id;},{timeout:90000});apiReady.catch(()=>{});
     await links.first().click();await page.waitForURL('**/cartes-du-jour?**');
    }
    const apiResponse=await apiReady;assert.equal(apiResponse.status(),200);await apiResponse.finished();
    await page.locator('.national-map[data-ready="true"]').first().waitFor({timeout:90000});
    await page.waitForTimeout(1200);
    record.maps=await page.locator('.national-map').evaluateAll(es=>es.map(e=>({ready:e.dataset.ready,contours:Number(e.dataset.renderedContourCount),features:Number(e.dataset.featureCount),values:Number(e.dataset.quantitativeCount),partial_values:Number(e.dataset.partialValueCount),covered_geometries:Number(e.dataset.coveredSupportCount)})));
    assert.ok(record.maps.length>0);for(const m of record.maps){assert.equal(m.features,713);assert.equal(m.contours,713);}
    record.api_data_received=true;
    if(name.startsWith('analyse')){const payload=await apiResponse.json();const bins=await page.locator('.agro-class-distribution > span').allTextContents();record.class_counts=bins.map(t=>Number(t.match(/:\s*(\d+)\s*PRA/)?.[1]??NaN));assert.equal(record.class_counts.reduce((a,b)=>a+b,0),payload.data.filter(r=>r.value!==null).length);}
    record.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(record.overflow,false);
    record.legends=await page.locator('[class*="legend"]').allTextContents();
    record.errors=errors.slice(priorErrors);assert.deepEqual(record.errors,[]);
    await page.screenshot({path:`${out}/${width}-${name}.png`,fullPage:true});record.passed=true;
   }catch(e){record.passed=false;record.error=e.message;failures.push({name,width,error:e.message});await page.screenshot({path:`${out}/${width}-${name}-failed.png`,fullPage:true}).catch(()=>{});}
   record.seconds=(performance.now()-began)/1000;record.api=responses.slice(first);checks.push(record);
   await writeFile(`${out}/browser.json`,JSON.stringify({kind:'full product pages, real API and Storage, no response interception',mode,checks,failures},null,2));
  }
  await page.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify({mode,checks:checks.length,passed:checks.filter(c=>c.passed).length,failures}));
if(failures.length)process.exitCode=1;
