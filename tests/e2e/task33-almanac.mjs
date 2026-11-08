import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {protectTask30Preview} from './task30-preview.mjs';
const origin=process.env.TASK33_ORIGIN??'http://localhost:3000',output=process.env.TASK33_OUTPUT??'docs/codex/task33/evidence/browser';
const selected=new URL(origin);if(!['localhost','127.0.0.1'].includes(selected.hostname)&&!selected.hostname.endsWith('.vercel.app'))throw Error('UNSUPPORTED_ORIGIN');
await mkdir(output,{recursive:true});
const report={origin,checks:[],errors:[]};
function check(name,ok){report.checks.push({name,ok});if(!ok)throw Error(name);}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},locale:'fr-FR',reducedMotion:'reduce'});await protectTask30Preview(context,origin);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const response=await page.goto(origin+'/almanach?date=2026-10-30&region=Bretagne&production=Bl%C3%A9+tendre',{waitUntil:'domcontentloaded',timeout:60000});check(name+' HTTP 200',response.status()===200);
  await page.getByRole('heading',{name:'L’Almanach agricole',exact:true}).waitFor();check(name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(name+' twelve month links',await page.getByRole('navigation',{name:'Les douze mois'}).getByRole('link').count()===12);
  await page.keyboard.press('Tab');check(name+' keyboard focus',await page.evaluate(()=>document.activeElement!==document.body));
  check(name+' canonical master not serialized',!(await page.content()).includes('texte_initial_autre_ia'));
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  await page.getByLabel('Date',{exact:true}).fill('2028-02-29');await page.getByRole('button',{name:'Consulter',exact:true}).click();await page.waitForLoadState('domcontentloaded');check(name+' leap day policy',await page.getByText('29 février : fenêtres saisonnières compatibles',{exact:false}).count()===1);check(name+' no inherited traditions',(await page.getByRole('heading',{name:'Repères et traditions du jour'}).locator('..').innerText()).includes('Aucun repère fixe'));
  await page.getByRole('navigation',{name:'Les douze mois'}).getByRole('link',{name:'mai',exact:true}).click();await page.getByRole('heading',{name:'1 mai 2028',exact:true}).waitFor();check(name+' month navigation',(await page.getByLabel('Date',{exact:true}).inputValue())==='2028-05-01');
  await page.goto(origin+'/almanach?date=2026-05-11',{waitUntil:'domcontentloaded'});check(name+' cultural marker explicit',(await page.locator('main.almanach').innerText()).includes('aucune valeur prédictive'));check(name+' exploratory windows explicit',(await page.locator('main.almanach').innerText()).toLocaleLowerCase().includes('relecture technique requise'));
  const bad=await page.goto(origin+'/almanach?date=2026-02-30',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'404',exact:true}).waitFor();check(name+' invalid date rejected',bad.status()===404||await page.locator('meta[name=robots][content=noindex]').count()>0);
  await context.close();
 }
 const headers=selected.protocol==='https:'&&process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
 const response=await fetch(origin+'/api/editorial-briefing/example',{headers,redirect:'error'}),raw=await response.text();check('briefing API 200',response.status===200);check('compact briefing < 96 KiB',Buffer.byteLength(raw)<96*1024);const b=JSON.parse(raw);check('real historical replay',b.edition_date==='2026-10-30'&&b.national.episodes.total===2734);check('ten wheat indicators',b.contributions.length===10);check('weak documentary matches never confirmation',b.documentary.links.length===0&&b.documentary.scientific_confirmation===false);
 check('conditional API 304',(await fetch(origin+'/api/editorial-briefing/example',{headers:{...headers,'if-none-match':response.headers.get('etag')},redirect:'error'})).status===304);check('no browser exceptions',report.errors.length===0);
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{await browser.close();await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');}
