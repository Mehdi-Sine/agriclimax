// Latency/error simulations are labelled and isolated from real cycle evidence.
import {chromium} from 'playwright';
import {protectTask30Preview} from './task30-preview.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TASK30_ORIGIN??'http://localhost:3010',output=process.env.TASK30_OUTPUT??'docs/codex/task30/evidence/loading';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,tested_commit:process.env.TASK30_COMMIT??null,simulated:true,checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,ok});if(!ok)throw new Error(name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await protectTask30Preview(context,origin);
 const page=await context.newPage();await page.emulateMedia({reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/?temporal=history&date=2026-10-31&indicateur=temperature&mode=value',{timeout:60000});
 await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.unified-map-title')?.textContent?.includes('Température moyenne'));
 let mode='slow';
 await context.route('**/api/unified?*',async route=>{
  if(mode==='error'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SIMULATED_FAILURE'})});return;}
  const response=await route.fetch();await new Promise(r=>setTimeout(r,1800));await route.fulfill({response});
 });
 const indicator=page.getByLabel(/Indicateur/).first();
 await indicator.selectOption('rain');
 await page.getByText('Sélection précédente conservée pendant la lecture.',{exact:false}).waitFor();
 check('reduced motion stops loader rotation',await page.locator('.map-updating').evaluate(e=>getComputedStyle(e,'::before').animationName==='none'));
 check('old title retained during delayed selection',(await page.locator('.unified-map-title').innerText()).includes('Température moyenne'));
 await page.screenshot({path:output+'/slow-previous-map.png',fullPage:true});
 await page.waitForFunction(()=>document.querySelector('.unified-map-title')?.textContent?.includes('Cumul de pluie'),{timeout:60000});
 await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
 check('title and legend committed after response',(await page.locator('.semantic-legend').innerText()).includes('mm'));
 await indicator.selectOption('temperature_max');await indicator.selectOption('rain');
 await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
 await page.waitForTimeout(2200);
 check('superseded request never replaces latest title',(await page.locator('.unified-map-title').innerText()).includes('Cumul de pluie'));
 mode='error';await indicator.selectOption('temperature_min');await page.getByRole('alert').filter({hasText:'Source momentanément inaccessible'}).waitFor({timeout:60000});
 await page.locator('.map-updating').waitFor({state:'hidden',timeout:60000});
 check('failure stops animation',await page.locator('.map-updating').count()===0);
 check('retry available',await page.getByRole('button',{name:'Réessayer',exact:true}).count()>0);
 await page.emulateMedia({reducedMotion:'reduce'});
 check('no uncaught errors',report.errors.length===0);
 await context.close();
}catch(e){report.failure=e.message;process.exitCode=1;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
