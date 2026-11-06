// Actual read-only Preview, normal TLS gateway; no source acquisition or data interception.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000},locale:'fr-FR',reducedMotion:'reduce'});
const report={mocks:false,base:'http://127.0.0.1:3031',cases:[],errors:[]};p.on('pageerror',e=>report.errors.push(e.message));
try{for(const [pra,label] of [['50081','hague'],['29102','crozon'],['2A258','corse']]){
 await p.goto(report.base+'/?pra=pra:'+pra+'&date=2026-10-31');await p.locator('.national-map[data-ready="true"]').waitFor({timeout:90000});
 await p.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:90000});
 await p.getByRole('button',{name:'Voir ce territoire',exact:true}).click();await p.locator('.national-map').scrollIntoViewIfNeeded();await p.waitForTimeout(1800);
 await p.locator('.national-map-wrap').screenshot({path:`docs/codex/task26/task26d-preview/coast-${label}.png`});
 const panel=await p.locator('.unified-panel').innerText();if(pra==='29102')assert.match(panel,/Indisponible/);else assert.match(panel,/portion réellement renseignée|aire renseignée|Couverture/);
 const box=await p.locator('.maplibregl-canvas').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.waitForTimeout(300);
 const hovers=new Set();for(const [x,y] of [[.35,.25],[.55,.25],[.5,.45],[.65,.5],[.4,.65],[.6,.7]]){await p.mouse.move(box.x+box.width*x,box.y+box.height*y);await p.waitForTimeout(150);hovers.add(await p.locator('.national-hover').innerText());}assert.ok([...hovers].some(t=>t.includes(pra)),label+' actual polygon hover');report.cases.push({pra,label,focusVisible:true,panel,hover:[...hovers]});
}
assert.deepEqual(report.errors,[]);await writeFile('docs/codex/task26/task26d-preview/coastal-real.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:report.cases.length,errors:report.errors}));}finally{await b.close();}
