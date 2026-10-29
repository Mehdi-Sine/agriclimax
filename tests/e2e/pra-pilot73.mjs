// Explicit operator check against the authorized real DEV pilot; no writes or mocks.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const web=createRequire(path.resolve('apps/web/package.json'));
const lint=createRequire(web.resolve('eslint-config-next'));
const axe=createRequire(lint.resolve('eslint-plugin-jsx-a11y'));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
 const page=await browser.newPage();
 const review=await readFile('work/task19b/review/map.html','utf8');
 for(const width of [1440,768,390]) {
  await page.setViewportSize({width,height:900});
  const mapStart=performance.now();
  await page.setContent(review);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const mapRenderMs=performance.now()-mapStart;
  assert.equal(await page.locator('svg path').count(),73);
  assert.equal(await page.locator('li[data-pra]').count(),73);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.addScriptTag({path:axe.resolve('axe-core/axe.min.js')});
  const audit=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.deepEqual(audit.violations.map(v=>v.id),[]);
  results.push({surface:'review-map',width,paths:73,cards:73,render_ms:mapRenderMs,aa_violations:0});
  const appStart=performance.now();
  await page.goto('http://127.0.0.1:3000/territories?pilot=73',{waitUntil:'networkidle'});
  const text=await page.locator('main').innerText();
  assert.ok(text.includes('73'));assert.ok(text.includes('Marseille'));assert.ok(!text.includes('Données territoriales indisponibles'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.addScriptTag({path:axe.resolve('axe-core/axe.min.js')});
  const appAudit=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  assert.deepEqual(appAudit.violations.map(v=>v.id),[]);
  results.push({surface:'pilot-app',width,navigation_through_audit_ms:performance.now()-appStart,aa_violations:0});
 }
 await page.goto('http://127.0.0.1:3000/territories?pilot=73&pra=pra%3A29102',{waitUntil:'networkidle'});
 assert.ok((await page.locator('main').innerText()).includes('unavailable'));
 await writeFile('work/task19b/browser.json',JSON.stringify({results,coastal_unavailable_explicit:true},null,2));
 console.log(JSON.stringify(results));
} finally {await browser.close();}
