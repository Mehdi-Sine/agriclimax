import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(webRequire.resolve('eslint-config-next'));
const a11yRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const axePath=a11yRequire.resolve('axe-core/axe.min.js');
const base='http://127.0.0.1:3000';
const artifacts=path.resolve(process.env.WHEAT_ARTIFACTS||'work/wheat-browser');
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
const reports=[];
try {
  for (const [name,width,height] of [['desktop',1440,900],['tablet',1024,768],['mobile',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage();
    const errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',async route=>{
      if(new URL(route.request().url()).origin!==base){external.push('remote-request');await route.abort();}
      else await route.continue();
    });
    await page.goto(`${base}/?mode=wheat`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('.wheat-map circle').count(),5);
    assert.equal(await page.locator('tbody tr').count(),5);
    assert.ok((await page.locator('main').innerText()).includes('mise à jour manuelle'));
    for(const theme of ['light','dark']) {
      if((await page.locator('html').getAttribute('data-theme')||'light')!==theme)
        await page.getByRole('button',{name:theme==='dark'?'Activer le thème sombre':'Activer le thème clair'}).click();
      for(const [view,url] of [['observation','/?mode=wheat'],['diagnostic','/diagnostic?mode=wheat&station=29075001'],['watch','/watch?mode=wheat']]) {
        await page.goto(base+url,{waitUntil:'networkidle'});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${view} overflow`);
        assert.ok((await page.locator('main').innerText()).includes('Indisponible'));
        assert.ok((await page.locator('main').innerText()).includes('exploratoire'));
        await page.addScriptTag({path:axePath});
        const audit=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
        reports.push({name,theme,view,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});
        if(view==='observation'||(name==='mobile'&&theme==='light')) await page.screenshot({path:path.join(artifacts,`${name}-${theme}-${view}.png`),fullPage:true});
      }
    }
    await page.goto(`${base}/?mode=wheat`,{waitUntil:'networkidle'});
    await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').innerText(),'Aller au contenu');
    await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main');
    await page.getByRole('link',{name:'Voir les preuves'}).first().click();
    await page.waitForURL(/\/diagnostic\?.*station=/);
    assert.equal(await page.locator('.wheat-indicators article').count(),10);
    await page.getByLabel('Début inclus').fill('2026-10-07');
    await page.getByLabel('Fin incluse').fill('2026-10-13');
    await page.getByRole('button',{name:'Consulter les calculs publiés'}).click();
    await page.waitForLoadState('networkidle');
    assert.ok((await page.locator('main').innerText()).includes('2026-10-07'));
    await page.getByLabel('Fenêtre phénologique').selectOption('anthese');
    await page.getByRole('button',{name:'Consulter les calculs publiés'}).click();
    await page.waitForLoadState('networkidle');
    assert.ok((await page.locator('main').innerText()).includes('Aucun portefeuille publié'));
    assert.deepEqual(errors,[],`${name} browser exceptions`);assert.equal(external.length,0,'No external calls from browser');
    await context.close();
  }
  const response=await fetch(`${base}/api/wheat?mode=wheat`);
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.length,5);
  assert.equal(body.risk_computed,false);
  assert.equal((await fetch(`${base}/api/wheat?mode=wheat&start=2026-02-30`)).status,400);
  await writeFile(path.join(artifacts,'report.json'),JSON.stringify(reports,null,2));
  assert.equal(reports.flatMap(r=>r.violations).length,0,'WCAG AA audit');
  console.log(`PASS: ${reports.length} responsive/theme/view audits, real station API, navigation, no inferred stage or browser remote requests`);
} finally {await browser.close();}
