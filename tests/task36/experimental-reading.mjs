import {chromium} from '../e2e/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out='work/experimental-reading';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height}});let openaiRequests=0;
 page.on('request',r=>{if(/openai.com/.test(r.url()))openaiRequests++;});
 await page.goto('http://localhost:3002/journal?date=2026-11-10',{waitUntil:'networkidle'});
 if(!await page.getByRole('heading',{level:1}).textContent().then(t=>t.includes('Gel prévu en Auvergne-Rhône-Alpes')))throw Error('Wrong real article');
 if(!await page.getByText('Édition expérimentale IA — contenu non entièrement vérifié',{exact:false}).count())throw Error('Missing experimental label');
 if(await page.getByText('Référence non résolue',{exact:false}).count()!==2)throw Error('Missing unresolved references');
 await page.getByText('Réserves scientifiques de cette édition').click();
 if(!await page.getByText('Contrôles enregistrés :',{exact:false}).textContent().then(t=>t.includes('BLOCK_REFERENCE')))throw Error('Missing alerts');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
 await page.screenshot({path:`${out}/${label}-nov10.png`,fullPage:true});
 await page.getByRole('link',{name:/9 novembre 2026 · Révision/}).click();
 await page.waitForURL(/date=2026-11-09/);
 if(!await page.getByRole('heading',{level:1}).textContent().then(t=>t.includes('Grand Est')))throw Error('Wrong historical edition');
 await page.goto('http://localhost:3002/journal?date=2000-01-01',{waitUntil:'networkidle'});
 if(!await page.getByRole('heading',{level:1}).textContent().then(t=>t.includes('Aucune édition')))throw Error('Missing empty state');
 if(openaiRequests)throw Error('OpenAI request detected');
 results.push({label,realArticle:true,archiveNavigation:true,missingDate:true,overflow:false,openaiRequests});await page.close();
}
await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));console.log(results);
