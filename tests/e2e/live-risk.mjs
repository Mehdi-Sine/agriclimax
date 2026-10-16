import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(webRequire.resolve('eslint-config-next'));
const axeRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const base=process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const dir=process.env.E2E_LIVE_ARTIFACTS || 'docs/codex/verification/task16';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[];
try {
  for (const width of (process.env.E2E_DISCONNECTED_ONLY ? [] : [1440,390])) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const query='mode=live_meteofrance&production=wheat&indicator=gdd&start=2026-10-07&end=2026-10-13';
    const response=await page.goto(`${base}/?${query}`,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(await page.locator('main').getByRole('alert').count(),0,'live published wheat source should load');
    await page.locator('svg[aria-label="Carte des indicateurs live par station"] a').filter({has:page.locator('text')}).first().click();
    await page.waitForLoadState('networkidle');
    const selected=new URL(page.url()).searchParams.get('station');
    assert.ok(selected);
    const gddText=await page.getByRole('region',{name:'Traçabilité de la sélection'}).innerText();
    assert.ok(!gddText.includes('Aucun calcul publié'));
    assert.ok(!gddText.includes('Indisponible'));
    // Change the scientific metric using the actual UI.
    await page.getByLabel('Indicateur',{exact:true}).selectOption('precipitation_sum');
    await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
    const rainText=await page.getByRole('region',{name:'Traçabilité de la sélection'}).innerText();
    assert.ok(rainText.includes('Cumul de précipitations'));
    assert.notEqual(gddText,rainText);
    assert.equal(new URL(page.url()).searchParams.get('station'),selected);
    const marker=page.locator('svg[aria-label="Carte des indicateurs live par station"] a[aria-current="true"]');
    assert.ok((await marker.getAttribute('aria-label')).includes('mm'),'map value uses selected rain metric');
    for (const [label,route] of [['Diagnostic','/diagnostic'],['Historique','/history'],['Veille','/watch'],['Carte','/']]) {
      await page.locator('header nav').getByRole('link',{name:label,exact:true}).click();await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname,route);
      const params=new URL(page.url()).searchParams;
      for(const [key,value] of [['station',selected],['indicator','precipitation_sum'],['start','2026-10-07'],['end','2026-10-13']]) assert.equal(params.get(key),value);
      const text=await page.locator('main').innerText();
      for(const fact of ['Source : Météo-France','Fraîcheur','exploratory','Limites','2026-10-07']) assert.ok(text.includes(fact),fact);
      if(route==='/diagnostic') assert.ok(text.includes('wheat.precipitation_sum'));
      if(route==='/history') assert.ok(text.includes('Date du calcul'));
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(layout.scroll<=width+1,`${label}: overflow ${layout.scroll}`);
      await page.addScriptTag({path:axeRequire.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
      assert.equal(violations.length,0,JSON.stringify(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
      await page.screenshot({path:`${dir}/wheat-${label}-${width}.png`,fullPage:false});
      reports.push({production:'wheat',view:label,width,layout,context_preserved:true,axe_violations:violations.length});
    }
    await page.locator('.live-map').screenshot({path:`${dir}/wheat-map-${width}.png`});
    await page.getByRole('button',{name:'Activer le thème sombre',exact:true}).click();
    await page.addScriptTag({path:axeRequire.resolve('axe-core/axe.min.js')});
    const darkViolations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
    assert.equal(darkViolations.length,0,JSON.stringify(darkViolations.map(v=>v.id)));
    await page.screenshot({path:`${dir}/wheat-dark-${width}.png`,fullPage:false});
    reports.push({production:'wheat',view:'Carte',theme:'dark',width,axe_violations:0});
    await page.getByRole('button',{name:'Activer le thème clair',exact:true}).click();
    // Unavailable anomaly stays null, never zero or a demo value.
    await page.getByLabel('Indicateur',{exact:true}).selectOption('temperature_anomaly');
    await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
    assert.ok((await page.getByRole('region',{name:'Traçabilité de la sélection'}).innerText()).includes('Indisponible'));
    // Switch production in place; the dependent indicator resets coherently.
    await page.getByLabel('Production',{exact:true}).selectOption('cattle');
    assert.equal(await page.getByLabel('Indicateur',{exact:true}).inputValue(),'thi');
    await page.getByLabel('Station',{exact:true}).selectOption('31069001');
    await page.getByLabel('Début inclus',{exact:true}).fill('2026-09-01');
    await page.getByLabel('Fin incluse',{exact:true}).fill('2026-09-30');
    await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
    const thi=await page.getByRole('region',{name:'Traçabilité de la sélection'}).innerText();
    assert.ok(thi.includes('75,45 THI'),thi);
    assert.ok(thi.includes('synthèse quotidienne'));
    for (const [label,route] of [['Diagnostic','/diagnostic'],['Historique','/history'],['Veille','/watch']]) {
      await page.locator('header nav').getByRole('link',{name:label,exact:true}).click();await page.waitForLoadState('networkidle');
      const text=await page.locator('main').innerText();
      assert.ok(text.includes('75,45 THI'));
      if(route==='/diagnostic') assert.ok(text.includes('cattle.thi.exposure'));
      if(route==='/history') assert.ok(text.includes('2026-09-30'));
      assert.equal(new URL(page.url()).searchParams.get('station'),'31069001');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.addScriptTag({path:axeRequire.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
      assert.equal(violations.length,0,JSON.stringify(violations.map(v=>v.id)));
      await page.screenshot({path:`${dir}/cattle-${label}-${width}.png`,fullPage:false});
      reports.push({production:'cattle',view:label,width,context_preserved:true,axe_violations:violations.length});
    }
    for(const [indicator,unit] of [['days_above','jours'],['episodes','épisodes']]) {
      await page.getByLabel('Indicateur',{exact:true}).selectOption(indicator);
      await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).searchParams.get('indicator'),indicator);
      const result=await page.getByRole('region',{name:'Traçabilité de la sélection'}).innerText();
      assert.ok(result.includes(unit));assert.ok(!result.includes('75,45 THI'));
    }
    await page.getByLabel('Support temporel',{exact:true}).selectOption('observations');
    await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
    assert.ok((await page.locator('main').innerText()).includes('Indisponible'));
    assert.ok(!(await page.locator('main').innerText()).includes('75,45 THI'));
    await page.goto(`${base}/?${query.replace('2026-10-13','2026-10-14')}`,{waitUntil:'networkidle'});
    assert.ok((await page.locator('main').innerText()).includes('Aucun calcul publié'));
    // Invalid contexts do not execute another production's rule or enter demo mode.
    await page.goto(`${base}/?${query}&station=invalid`,{waitUntil:'networkidle'});
    assert.ok((await page.locator('main').innerText()).includes('Contexte invalide'));
    assert.equal(await page.locator('.live-map circle').count(),0);
    assert.deepEqual(errors,[],'no hydration or runtime errors');
    await page.close();
  }
  const unavailableBase = process.env.E2E_UNAVAILABLE_BASE_URL || (process.env.E2E_DISCONNECTED_ONLY ? base : null);
  if (unavailableBase) {
    const page=await browser.newPage({viewport:{width:390,height:900}});
    for(const production of ['wheat','cattle']) {
      await page.goto(`${unavailableBase}/?mode=live_meteofrance&production=${production}&start=2026-10-07&end=2026-10-13`,{waitUntil:'networkidle'});
      assert.ok(await page.getByRole('alert').count());
      assert.ok((await page.locator('main').innerText()).includes('Indisponible'));
      assert.equal(await page.locator('.live-map circle').count(),0,'no fixture markers when source is disconnected');
      reports.push({production,width:390,source_disconnected:true,no_fallback:true});
    }
    await page.close();
  }
  await writeFile(`${dir}/browser-report.json`,JSON.stringify({base,reports,real_sources:!process.env.E2E_DISCONNECTED_ONLY,passed:true},null,2));
  console.log(process.env.E2E_DISCONNECTED_ONLY ? 'Disconnected live wheat/cattle sources: explicit errors and no fixture markers passed.' : 'Live wheat/cattle UI flow, station selection, map metric, diagnostic, history, watch, absence, invalid context, responsive and WCAG AA: passed.');
} finally {await browser.close();}
