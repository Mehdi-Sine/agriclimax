// Read-only LOCAL preview; this does not claim a real generated or published edition.
import {chromium} from '../e2e/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/codex/task36/evidence/browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 let openaiRequests=0;page.on('request',r=>{if(r.url().includes('openai.com'))openaiRequests++;});
 for(const [state,query] of [['latest',''],['historical','?date=2026-10-30'],['absent','?date=2000-01-01']]) {
  const response=await page.goto('http://localhost:3002/journal/preview'+query,{waitUntil:'networkidle'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(response.status()!==200||overflow||openaiRequests) throw Error('Preview failure');
  await page.screenshot({path:`${output}/${label}-${state}.png`,fullPage:true});
  results.push({label,state,status:response.status(),overflow,openaiRequests});
 }
 await page.close();
}
await browser.close();await writeFile(`${output}/report.json`,JSON.stringify({scope:'local preview, no real publication',results},null,2));
