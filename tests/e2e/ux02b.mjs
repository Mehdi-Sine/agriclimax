import assert from 'node:assert/strict';
import {X509Certificate,createHash as hashCertificate} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from './node_modules/playwright/index.mjs';
const base=process.env.BASE_URL??'http://localhost:3001';
const out=process.env.EVIDENCE_DIR??'work/ux02b';
await mkdir(out,{recursive:true});
const require=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(require.resolve('eslint-config-next'));
const a11yRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const axePath=a11yRequire.resolve('axe-core/axe.min.js');
const png=await readFile('apps/web/public/brand/climate-stripes.png');
assert.equal(createHash('sha256').update(png).digest('hex'),'728f390f82e0b797e12d7c352ffb797696b90caf483f44a9ed4b1b2f9e2bd705');
// Scope Chromium's additional trust to the environment's configured proxy CA.
const proxyCertificate=process.env.NODE_EXTRA_CA_CERTS?new X509Certificate(await readFile(process.env.NODE_EXTRA_CA_CERTS)):null;
const proxyTrust=proxyCertificate?[`--ignore-certificate-errors-spki-list=${hashCertificate('sha256').update(proxyCertificate.publicKey.export({type:'spki',format:'der'})).digest('base64')}`]:[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader',...proxyTrust],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}}:{})});
const report=[];
try {
 for(const [label,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',extraHTTPHeaders:process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const [name,route] of [['journal','/?date=2026-11-12'],['cartes','/cartes-du-jour?date=2026-11-12']]){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});
   assert.equal(response.status(),200);assert.equal(response.request().redirectedFrom(),null,'Home must render directly');
   if(name==='journal'){
    await page.waitForFunction(()=>document.querySelectorAll('.journal-thumbnail[data-state=ready]').length===10,{},{timeout:90000});
    assert.equal(await page.locator('.maplibregl-canvas').count(),0);
    assert.equal(await page.locator('.journal-map-card').count(),10);
   }else{
    await page.locator('.maplibregl-canvas').waitFor({timeout:90000});
    await page.waitForFunction(()=>!document.body.innerText.includes('Application des couleurs…'),{},{timeout:30000});
   }
   assert.equal(await page.locator('.unified-product').count(),0,'No explorer flash or duplicate workspace');
   assert.equal(await page.locator('.editorial-wordmark').innerText(),'Climacta.');
   assert.equal(await page.locator('.editorial-logo small').textContent(),'Le climat des territoires agricoles.');
   if(name==='cartes')assert.equal(await page.getByRole('combobox',{name:'Indicateur de l’édition',exact:true}).locator('option').count(),10);
   if(name==='journal')assert.match(await page.locator('.ux01-edition-meta').innerText(),/12 NOVEMBRE 2026/);
   const identity=await page.evaluate(()=>{
    const style=s=>getComputedStyle(document.querySelector(s));
    return {stripeHeight:style('.editorial-stripes').height,stripeImage:style('.editorial-stripes').backgroundImage,logoFont:style('.editorial-wordmark').fontFamily,logoSize:style('.editorial-wordmark').fontSize,ink:style('h1').color,background:style('body').backgroundColor,coral:style('.editorial-wordmark span').color,titleSize:style('h1').fontSize,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(identity.stripeHeight,'10px');assert.match(identity.stripeImage,/climate-stripes\.png/);
   assert.equal(identity.logoSize,'36px');assert.match(identity.logoFont,/Georgia/);
   assert.equal(identity.ink,'rgb(24, 43, 64)');assert.equal(identity.background,'rgb(248, 250, 251)');
   assert.equal(identity.coral,'rgb(199, 81, 89)');assert.equal(identity.overflow,false);
   if(name==='journal')assert.ok(parseFloat(identity.titleSize)<=58);
   await page.addScriptTag({path:axePath});
   const violations=await page.evaluate(async()=>{
    const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
    return result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
   });
   await page.screenshot({path:`${out}/after-${name}-${label}.png`,fullPage:true});
   report.push({label,name,route,identity,violations});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 assert.ok(report.every(r=>r.violations.length===0),'Accessibility violations: see visual-report.json');
}finally{await browser.close();await writeFile(`${out}/visual-report.json`,JSON.stringify(report,null,2));}
console.log('UX-02B: direct home, exact identity, 10 maps, responsive and WCAG checks passed.');
