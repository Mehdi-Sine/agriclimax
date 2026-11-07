// Real API/UI acceptance; synthetic routing used only for explicitly labelled failure/latency checks.
import {chromium} from 'playwright';
import {protectTask30Preview} from './task30-preview.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.TASK30_ORIGIN??'http://127.0.0.1:3000',output=process.env.TASK30_OUTPUT??'docs/codex/task30/evidence/local';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,tested_commit:process.env.TASK30_COMMIT??null,checks:[],errors:[],responses:[]};
const check=(name,ok,detail={})=>{report.checks.push({name,ok,...detail});if(!ok)throw new Error(name);};
try{
 for(const [viewport,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},locale:'fr-FR'});
  await protectTask30Preview(context,origin);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({viewport,message:e.message}));
  const started=Date.now();
  await page.goto(origin+'/veille',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:'La situation agroclimatique en France'}).waitFor();
  await page.locator('.watch-overview').waitFor({timeout:60000});
  await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
  report.responses.push({viewport,map_ready_ms:Date.now()-started});
  check(viewport+':713 contours',await page.locator('.national-map').getAttribute('data-feature-count')==='713');
  check(viewport+':no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${output}/${viewport}-national.png`,fullPage:true});
  const filter=page.getByLabel(/Phénomène/);await filter.selectOption('rain');
  await page.locator('.national-map[data-ready="true"]').waitFor();
  check(viewport+':rain blue',await page.locator('.legend-ramp span').last().evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(36, 83, 110)');
  const cards=page.locator('.watch-event');check(viewport+':real rain event',await cards.count()>0);
  await cards.first().getByRole('button',{name:/Explorer .* PRA/}).click();
  await page.getByRole('heading',{name:'Contexte agricole déclaré'}).waitFor();
  check(viewport+':URL context',new URL(page.url()).searchParams.has('situation')&&new URL(page.url()).searchParams.has('pra'));
  await page.screenshot({path:`${output}/${viewport}-territory.png`,fullPage:true});
  if(viewport==='desktop'){
   await page.getByRole('link',{name:'Explorer les indicateurs et la provenance'}).click();
   await page.getByRole('link',{name:'← Revenir à la veille nationale'}).click();
   await page.waitForURL(url=>url.pathname==='/veille'&&url.searchParams.has('situation'),{timeout:60000});
   check('return preserves event',new URL(page.url()).searchParams.has('situation'));
  }
  await page.getByRole('link',{name:'Comprendre cette carte',exact:true}).first().click();
  await page.getByRole('heading',{name:'Comprendre les cartes',exact:true}).waitFor();
  check(viewport+':contextual help',new URL(page.url()).hash==='#rain-day');
  if(viewport==='desktop'){
   await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`${output}/desktop-help-dark.png`,fullPage:true});
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.goto(origin+'/veille?phenomene=dry');await page.locator('.watch-overview').waitFor();
   await page.keyboard.press('Tab');check('keyboard focus',await page.evaluate(()=>document.activeElement!==document.body));
  }
  await context.close();
 }
 check('no uncaught application errors',report.errors.length===0);
}catch(e){report.failure=e.message;process.exitCode=1;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
