// Real read-only UI verification when a migrated live source is configured.
// CI's disconnected mode verifies failures without substituting test data.
import assert from 'node:assert/strict';
import {mapControls,historyAndLatest} from './task18-journey.mjs';
import {auditDiagnostic} from './diagnostic-privacy.mjs';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(webRequire.resolve('eslint-config-next'));
const axeRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000';
const dir=process.env.E2E_LIVE_ARTIFACTS||'work/task16/e2e-live';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[];
try {
  for(const width of (process.env.E2E_DISCONNECTED_ONLY?[]:[1440,768,390])) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const production of ['wheat','cattle']) {
      await page.goto(`${base}/?mode=live_meteofrance&production=${production}`,{waitUntil:'networkidle'});
      await page.getByLabel('Production',{exact:true}).selectOption(production);
      await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).searchParams.get('production'),production);
      assert.equal(await page.locator('main').getByRole('alert').count(),0,'daily publication must be readable');
      assert.ok(await page.locator('.live-map a').count(),'successful publication has stations');
      const start=await page.getByLabel('Début inclus',{exact:true}).inputValue();
      const end=await page.getByLabel('Fin incluse',{exact:true}).inputValue();
      await mapControls(page);
      await page.locator('.live-map a').first().click();await page.waitForLoadState('networkidle');
      const station=new URL(page.url()).searchParams.get('station');assert.ok(station);
      const metric=production==='wheat'?'precipitation_sum':'days_above';
      await page.getByLabel('Indicateur',{exact:true}).selectOption(metric);
      await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
      for(const label of ['Carte','Diagnostic','Historique','Veille']) {
        await page.locator('header nav').getByRole('link',{name:label,exact:true}).click();await page.waitForLoadState('networkidle');
        const text=await page.locator('main').innerText();
        for(const fact of ['Dernière publication quotidienne réussie','Source : Météo-France','Fraîcheur','exploratory',start,end]) assert.ok(text.includes(fact),fact);
        assert.equal(await page.locator('main').getByRole('alert').count(),0);
        for(const [key,value] of [['station',station],['indicator',metric],['start',start],['end',end]]) assert.equal(new URL(page.url()).searchParams.get(key),value);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await page.addScriptTag({path:axeRequire.resolve('axe-core/axe.min.js')});
        const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
        assert.deepEqual(violations.map(v=>v.id),[]);
        const performance=await historyAndLatest(page);
        if(label==='Historique' && production==='cattle') assert.ok(text.includes('Anomalie THI indisponible'));
        if(label==='Diagnostic') await auditDiagnostic(page,dir,`${production}-${width}`);
        await page.screenshot({path:`${dir}/${production}-${label}-${width}.png`});
        reports.push({production,label,width,start,end,station,context_preserved:true,axe:0,performance});
      }
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  const unavailableBase=process.env.E2E_UNAVAILABLE_BASE_URL||(process.env.E2E_DISCONNECTED_ONLY?base:null);
  if(unavailableBase) {
    const page=await browser.newPage({viewport:{width:390,height:900}});
    for(const production of ['wheat','cattle']) {
      await page.goto(`${unavailableBase}/?mode=live_meteofrance&production=${production}`,{waitUntil:'networkidle'});
      assert.ok(await page.locator('main').getByRole('alert').count());
      assert.ok((await page.locator('main').innerText()).includes('indisponible'));
      assert.equal(await page.locator('.live-map circle').count(),0,'no fixture markers');
      reports.push({production,width:390,source_disconnected:true,no_fallback:true});
    }
    await page.close();
  }
  await writeFile(`${dir}/browser-report.json`,JSON.stringify({base,reports,real_sources:!process.env.E2E_DISCONNECTED_ONLY,passed:true},null,2));
  console.log('Live daily publication journeys / disconnected boundary passed.');
} finally {await browser.close();}
