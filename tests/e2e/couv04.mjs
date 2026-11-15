// Local isolated preview only. Creates and removes its own temporary Next route.
import {chromium} from 'playwright';
import {mkdir,writeFile,copyFile,rm,access} from 'node:fs/promises';
import {openSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
const route='apps/web/app/couv04-preview',port=3014;
try{await access(route);throw Error('Preview route already exists; preserve it');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(route,{recursive:true});await mkdir('work/couv04',{recursive:true});
const results=[];let browser,server;
try{
 for(const file of ['page.tsx','preview.tsx'])await copyFile(`tests/e2e/fixtures/couv04-preview/${file}`,`${route}/${file}`);
 const prepared=spawnSync(process.execPath,['features/observation/prepare-worker.mjs'],{cwd:'apps/web'});if(prepared.status!==0)throw Error('Worker preparation failed');
 const log=openSync('work/couv04/preview-server.log','w');
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{cwd:'apps/web',env:{...process.env,NEXT_PUBLIC_COUV04_RENDER_ENABLED:'false'},detached:true,stdio:['ignore',log,log]});
 let ready=false;for(let i=0;i<40;i++){try{const response=await fetch(`http://127.0.0.1:${port}/couv04-preview`);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 if(!ready)throw Error('Preview did not start');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/couv04-preview`,{waitUntil:'networkidle'});
  await page.locator('.national-map[data-ready="true"]').nth(1).waitFor({timeout:60000});
  for(const indicator of width===1440?['rain','temperature_mean','temperature_min']:['rain']){
   await page.getByLabel('Indicateur',{exact:true}).selectOption(indicator);
   await page.locator('.national-map[data-ready="true"]').nth(1).waitFor();
   await page.waitForTimeout(500);
   const counts=await page.locator('.national-map').evaluateAll(es=>es.map(e=>e.dataset.renderedContourCount));
   if(counts.length!==2||counts.some(n=>n!=='713'))throw Error('713 contours missing');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error('horizontal overflow');
   if(errors.length)throw Error(errors.join('; '));
   await page.screenshot({path:`docs/codex/COUV-04/evidence/browser-${width}-${indicator}.png`,fullPage:true});
   results.push({width,indicator,contours:counts,overflow,errors});
  }
  await page.close();
 }
}finally{
 if(browser)await browser.close();if(server?.pid)process.kill(-server.pid,'SIGTERM');
 await rm(route,{recursive:true,force:true});
 await writeFile('docs/codex/COUV-04/evidence/browser.json',JSON.stringify(results,null,2));
}
