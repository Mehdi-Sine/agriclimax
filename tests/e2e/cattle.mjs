import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(webRequire.resolve('eslint-config-next'));
const a11yRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const dir='docs/codex/verification/task14';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const reports=[];
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const query='mode=live_meteofrance&production=cattle&indicator=thi&station=31069001&start=2026-09-01&end=2026-09-30';
    for(const [view,route] of [['observation','/'],['diagnostic','/diagnostic'],['watch','/watch']]) {
      const response=await page.goto(`http://127.0.0.1:3000${route}?${query}`,{waitUntil:'networkidle'});
      assert.equal(response.status(),200);
      await page.getByRole('heading',{level:1}).waitFor();
      assert.equal(await page.locator('main').getByRole('alert').count(),0,'real source should load');
      if(view === 'diagnostic') assert.ok((await page.locator('main').innerText()).includes('cattle.thi.exposure'));
      assert.ok((await page.locator('main').innerText()).includes('75,45 THI'));
      assert.ok((await page.locator('main').innerText()).includes('microclimat'));
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(layout.scroll<=width+1,`${view}: horizontal page overflow ${layout.scroll}`);
      await page.addScriptTag({path:a11yRequire.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=> (await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
      assert.equal(violations.length,0,JSON.stringify(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
      await page.screenshot({path:`${dir}/${view}-${width}.png`,fullPage:false});
      const nav=await page.locator('header nav a').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
      assert.ok(nav.every(url=>url.includes('station=31069001')&&url.includes('start=2026-09-01')));
      reports.push({view,width,status:response.status(),layout,axe_violations:violations.length,context_preserved:true});
    }
    await page.goto(`http://127.0.0.1:3000/diagnostic?${query}&product=observations`,{waitUntil:'networkidle'});
    assert.ok((await page.locator('main').innerText()).includes('Indisponible'));
    assert.ok(!(await page.locator('main').innerText()).includes('75,45 THI'));
    await page.close();
  }
  await writeFile(`${dir}/browser-report.json`,JSON.stringify(reports,null,2));
  console.log('Live cattle routes, shared context, unavailable hourly, responsive layout and WCAG AA checks passed.');
} finally {await browser.close();}
