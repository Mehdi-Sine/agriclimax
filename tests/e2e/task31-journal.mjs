// Real archives only. Failures are reported without substituting synthetic content.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {protectTask30Preview} from './task30-preview.mjs';
const origin=process.env.TASK31_ORIGIN??'http://localhost:3000',output=process.env.TASK31_OUTPUT??'docs/codex/task31/evidence/local';
const selected=new URL(origin);if(!['localhost','127.0.0.1'].includes(selected.hostname)&&!selected.hostname.endsWith('.vercel.app'))throw new Error('Unsupported origin');
await mkdir(output,{recursive:true});
const headers=selected.protocol==='https:'?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
const report={origin,checks:[],errors:[],payload_bytes:0};
const check=(name,ok)=>{report.checks.push({name,ok});if(!ok)throw new Error(name);};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const response=await fetch(origin+'/api/journal',{headers,redirect:'error',signal:AbortSignal.timeout(60000)}),raw=await response.text();check('real edition API 200',response.status===200);const e=JSON.parse(raw);report.payload_bytes=Buffer.byteLength(raw);report.edition={id:e.edition_id,date:e.edition_date,cycles:e.source_cycles,headline:e.headline};
 check('compact without geometries or individual metrics',!('metrics'in e)&&!raw.includes('coordinates')&&report.payload_bytes<250000);
 const conditional=await fetch(origin+'/api/journal',{headers:{...headers,'if-none-match':response.headers.get('etag')},redirect:'error'});check('ETag 304',conditional.status===304);
 const bad=await fetch(origin+'/api/journal?run=2026-02-30',{headers,redirect:'error'});check('invalid query 400',bad.status===400);
 const old=await fetch(origin+'/api/journal?run=2026-11-06',{headers,redirect:'error'});check('archived edition 200',old.status===200);const archive=await old.json();check('old edition distinct identity',archive.edition_id!==e.edition_id);
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},locale:'fr-FR'});await protectTask30Preview(context,origin);const page=await context.newPage();const geometries=[];page.on('request',r=>{if(r.url().includes('.geojson'))geometries.push(r.url());});page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(origin+'/journal',{waitUntil:'networkidle',timeout:60000});await page.getByRole('heading',{name:'Le Journal agroclimatique',exact:true}).waitFor();
  check(name+' real headline',await page.getByRole('heading',{name:e.headline,exact:true}).count()===1);
  check(name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(name+' no geometry request',geometries.length===0);await page.keyboard.press('Tab');check(name+' keyboard focus',await page.evaluate(()=>document.activeElement!==document.body));
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  await page.getByText('Consulter les autres régions',{exact:true}).click();check(name+' all regions available',await page.locator('article[id^="region-"]').count()===13);
  await page.goto(origin+'/journal?run=2026-11-06',{waitUntil:'networkidle',timeout:60000});check(name+' archived date visible',(await page.locator('header').innerText()).includes('2026-11-06'));await context.close();
 }
 check('no browser errors',report.errors.length===0);
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
