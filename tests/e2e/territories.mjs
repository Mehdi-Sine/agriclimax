// Disconnected territorial UI checks; never proof of official PRA climate coverage.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const web=createRequire(path.resolve('apps/web/package.json'));
const lint=createRequire(web.resolve('eslint-config-next'));
const axe=createRequire(lint.resolve('eslint-plugin-jsx-a11y'));
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.PRA_ARTIFACTS||'work/task19/browser';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report=[];
try {
 for(const width of [1440,768,390]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(`${base}/territories`,{waitUntil:'networkidle'});
  assert.ok((await page.locator('main').innerText()).includes('Référentiel PRA non déployé'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByLabel('Département',{exact:true}).fill('2A');
  await page.getByLabel('Rechercher une PRA',{exact:true}).fill('Corse');
  await page.getByRole('button',{name:'Rechercher',exact:true}).click();await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).searchParams.get('department'),'2A');
  await page.addScriptTag({path:axe.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
  assert.deepEqual(violations.map(v=>v.id),[]);
  await page.screenshot({path:`${dir}/territories-${width}.png`});
  const missing=await page.request.get(`${base}/api/territories?reference=missing-version&department=2A`);
  assert.ok([502,503].includes(missing.status()));
  const invalid=await page.request.get(`${base}/api/territories?reference=test&limit=101`);assert.equal(invalid.status(),400);
  await page.getByRole('link',{name:'Carte et diagnostic live · stations Météo-France',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('mode')==='live_meteofrance');
  assert.equal(new URL(page.url()).searchParams.get('mode'),'live_meteofrance');
  report.push({width,axe:0,no_overflow:true,missing_reference_explicit:true,station_route_preserved:true,official_pra_validated:0});await page.close();
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({base,synthetic_disconnected:true,reports:report},null,2));console.log('PRA unavailable UI, URL filters, responsive and WCAG AA checks passed.');
} finally {await browser.close();}
