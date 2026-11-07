import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {protectTask30Preview} from './task30-preview.mjs';
const origin=process.env.TASK30_ORIGIN??'http://localhost:3010',output=process.env.TASK30_OUTPUT??'docs/codex/task30/evidence/history';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,checks:[],errors:[]};
const check=(name,ok)=>{report.checks.push({name,ok});if(!ok)throw new Error(name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'fr-FR'});await protectTask30Preview(context,origin);
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/veille?periode=history',{timeout:60000});
 await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
 const legend=page.locator('.semantic-legend');
 check('historical anomaly is explicit',(await legend.innerText()).includes('centrée sur 0 °C'));
 check('neutral class centred on zero',(await legend.innerText()).includes('> -1 à 1'));
 check('missing reference kept distinct',(await page.locator('body').innerText()).includes('sans anomalie calculable'));
 await page.screenshot({path:output+'/temperature-anomaly.png',fullPage:true});
 await page.getByLabel(/Écart à la normale/).selectOption('precipitation');
 await page.locator('.national-map[data-ready="true"]').waitFor();
 check('rain departure uses dry deficit and blue excess',(await legend.innerText()).includes('Déficit sec, référence neutre, excédent bleu'));
 await page.screenshot({path:output+'/rain-departure.png',fullPage:true});
 await page.goto(origin+'/veille?cycle=2026-11-06T00%3A00%3A00Z',{timeout:60000});
 await page.locator('.watch-overview').waitFor({timeout:60000});
 check('archived run explicitly selected',(await page.locator('body').innerText()).includes('Cycle archivé choisi'));
 check('real old cycle independently marked stale',(await page.locator('body').innerText()).includes('Cycle ancien, de plus de 36 heures'));
 await page.screenshot({path:output+'/old-cycle.png',fullPage:true});
 await page.goto(origin+'/analyse?temporal=history&agro=rain&agro_start=2026-10-31&agro_end=2026-10-31&pra=pra:29102',{timeout:60000});
 await page.getByRole('heading',{name:/CROZON/}).waitFor({timeout:60000});
 await page.getByText(/Reconstruction spatiale|Estimation complémentaire|reconstruction complémentaire/i).first().waitFor({timeout:60000});
 check('Crozon historical complementary restitution preserved',true);
 await page.screenshot({path:output+'/crozon-reconstruction.png',fullPage:true});
 check('no uncaught application errors',report.errors.length===0);
 await context.close();
}catch(e){report.failure=e.message;process.exitCode=1;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
