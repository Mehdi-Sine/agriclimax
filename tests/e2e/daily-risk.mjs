// Isolated integration: synthetic Task17 publication over real HTTPS to the
// production Next server. Never evidence of production source availability.
import assert from 'node:assert/strict';
import {mapControls,historyAndLatest} from './task18-journey.mjs';
import {auditDiagnostic} from './diagnostic-privacy.mjs';
import {createServer} from 'node:https';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const webRequire=createRequire(path.resolve('apps/web/package.json'));
const lintRequire=createRequire(webRequire.resolve('eslint-config-next'));
const axeRequire=createRequire(lintRequire.resolve('eslint-plugin-jsx-a11y'));
const dir=process.env.DAILY_ARTIFACTS||'work/task16/e2e-daily';
await mkdir(dir,{recursive:true});
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',`${dir}/key.pem`,'-out',`${dir}/cert.pem`,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
const publication=JSON.parse(await readFile('tests/e2e/daily-publication.synthetic.json','utf8'));
for (const result of [...publication.payload.wheat.flatMap(p=>p.results),...publication.payload.cattle]) {
  result.provenance[0].private_detail='diagnostic-private-provenance-canary';
}
let state='published';const calls=[];
const source=createServer({key:await readFile(`${dir}/key.pem`),cert:await readFile(`${dir}/cert.pem`)},async(req,res)=>{
  let body='';for await(const chunk of req) body+=chunk;
  assert.equal(req.url,'/rest/v1/rpc/agriclimax_read_daily');
  const query=JSON.parse(body);calls.push({state,query});
  res.setHeader('content-type','application/json');
  if(state==='disconnected'){res.writeHead(503);res.end('{}');return;}
  if(state==='empty'){res.end(JSON.stringify({latest:null,selected:null}));return;}
  const current=structuredClone(publication);
  if(state==='insufficient') {
    for(const r of current.payload.wheat[0].results) {r.value=null;r.available_days=0;}
    const c=current.payload.cattle[0];c.value=null;c.status='insufficient';c.confidence.coverage=0;
    for(const m of c.metrics) {m.days_above=null;m.episodes=null;m.max_episode_duration=null;m.partial=true;}
  }
  const selected=query.p_start===null || query.p_start===publication.payload.from && query.p_end===publication.payload.to?current:null;
  // A failed acquisition does not change the successful publication table.
  res.end(JSON.stringify({latest:current,selected}));
});
await new Promise(resolve=>source.listen(0,'127.0.0.1',resolve));
const sourcePort=source.address().port;
const log=await import('node:fs').then(fs=>fs.openSync(`${dir}/server.log`,'w'));
const server=spawn(process.execPath,[webRequire.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3016'],{
  cwd:path.resolve('apps/web'),stdio:['ignore',log,log],env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`https://127.0.0.1:${sourcePort}`,SUPABASE_SECRET_KEY:'synthetic-e2e-only',WHEAT_STORAGE:'snapshots',NODE_EXTRA_CA_CERTS:path.resolve(`${dir}/cert.pem`)},
});
let browser;const reports=[];
try {
  let ready=false;
  for(let i=0;i<100;i++){
    if(server.exitCode!==null) throw new Error('Next exited; see server.log');
    try {await fetch('http://127.0.0.1:3016/?mode=demo');ready=true;break;} catch {await new Promise(r=>setTimeout(r,200));}
  }
  assert.ok(ready,'Next ready');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  for(const width of [1440,768,390]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const production of ['wheat','cattle']) {
      state='published';
      await page.goto(`http://127.0.0.1:3016/?production=${production}`,{waitUntil:'networkidle'});
      assert.equal(await page.getByLabel('Début inclus',{exact:true}).inputValue(),publication.payload.from);
      assert.equal(await page.getByLabel('Fin incluse',{exact:true}).inputValue(),publication.payload.to);
      await mapControls(page);
      const marker=page.locator('.live-map a').first();await marker.click();await page.waitForLoadState('networkidle');
      const station=new URL(page.url()).searchParams.get('station');assert.ok(station);
      const metric=production==='wheat'?'precipitation_sum':'days_above';
      await page.getByLabel('Indicateur',{exact:true}).selectOption(metric);
      await page.getByRole('button',{name:'Afficher',exact:true}).click();await page.waitForLoadState('networkidle');
      for(const label of ['Carte','Diagnostic','Historique','Veille']) {
        await page.locator('header nav').getByRole('link',{name:label,exact:true}).click();await page.waitForLoadState('networkidle');
        const text=await page.locator('main').innerText();
        for(const fact of ['Dernière publication quotidienne réussie',publication.payload.computed_at,'ancienne (stale)','État du dernier run quotidien : inconnu','Source : Météo-France']) assert.ok(text.includes(fact),`${production}/${label}: ${fact}`);
        assert.equal(new URL(page.url()).searchParams.get('station'),station);
        assert.equal(new URL(page.url()).searchParams.get('indicator'),metric);
        const performance=await historyAndLatest(page);
        if(label==='Historique' && production==='cattle') assert.ok(text.includes('Anomalie THI indisponible'));
        assert.equal(await page.locator('main').getByRole('alert').count(),0);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await page.addScriptTag({path:axeRequire.resolve('axe-core/axe.min.js')});
        const violations=await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
        assert.deepEqual(violations.map(v=>v.id),[]);
        await page.screenshot({path:`${dir}/${production}-${label}-${width}.png`});
        if(label==='Diagnostic') await auditDiagnostic(page,dir,`${production}-${width}`);
        if(label==='Carte') await page.getByRole('region',{name:'Traçabilité de la sélection'}).screenshot({path:`${dir}/${production}-traceability-${width}.png`});
        reports.push({production,label,width,axe:0,context_preserved:true,performance});
      }
      state='failed-with-previous';await page.reload({waitUntil:'networkidle'});
      assert.ok((await page.locator('main').innerText()).includes(publication.payload.computed_at));
      assert.equal(await page.locator('main').getByRole('alert').count(),0);
      state='published';
      for(const route of ['/','/diagnostic','/history','/watch']) {
        const before=calls.length;
        await page.goto(`http://127.0.0.1:3016${route}?production=${production}&start=2026-02-30&end=2026-03-01`,{waitUntil:'networkidle'});
        assert.ok((await page.locator('main').innerText()).includes('Contexte invalide'));
        assert.equal(calls.length,before,'invalid dates must not query upstream');
        await page.goto(`http://127.0.0.1:3016${route}?production=${production}&station=99999999`,{waitUntil:'networkidle'});
        assert.ok((await page.locator('main').innerText()).includes('Station inconnue'));
        assert.equal(await page.getByLabel('Station',{exact:true}).inputValue(),'99999999');
      }
      state='insufficient';
      await page.goto(`http://127.0.0.1:3016/watch?production=${production}&station=${station}`,{waitUntil:'networkidle'});
      assert.ok((await page.locator('main').innerText()).includes('Veille indisponible'));
      state='published';
      await page.goto(`http://127.0.0.1:3016/?production=${production}&start=2026-09-02&end=2026-09-03`,{waitUntil:'networkidle'});
      assert.ok((await page.locator('main').innerText()).includes('Aucun calcul publié'));
      for(const unavailable of ['empty','disconnected']) {
        state=unavailable;
        for(const route of ['/','/diagnostic','/history','/watch']) {
          await page.goto(`http://127.0.0.1:3016${route}?production=${production}`,{waitUntil:'networkidle'});
          assert.equal(await page.locator('.live-map circle').count(),0);
          const text=await page.locator('main').innerText();
          assert.ok(text.includes(unavailable==='empty'?'Aucun calcul publié':'Publication quotidienne indisponible'));
          assert.ok(!text.includes(publication.content_key));
        }
      }
      reports.push({production,width,failed_run_retains_previous:true,missing_window:true,empty:true,disconnected:true,no_fallback:true});
    }
    await page.goto('http://127.0.0.1:3016/?mode=demo',{waitUntil:'networkidle'});
    assert.ok((await page.locator('body').innerText()).includes('Démo'));
    assert.ok(!(await page.locator('main').innerText()).includes('Mode live · données réelles'));
    assert.deepEqual(errors,[]);await page.close();
  }
  assert.ok(calls.every(c=>c.query && Object.keys(c.query).sort().join(',')==='p_end,p_start'));
  await writeFile(`${dir}/report.json`,JSON.stringify({synthetic:true,passed:true,reports,source_calls:calls.length},null,2));
  console.log('Daily publication E2E desktop/mobile: all views, freshness, provenance, failed-run retention, absence, disconnection, no fallback, WCAG AA passed (synthetic source).');
} finally {
  await browser?.close();server.kill();await new Promise(resolve=>source.close(resolve));
}
