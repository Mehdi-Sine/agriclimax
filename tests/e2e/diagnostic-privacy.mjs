import assert from 'node:assert/strict';
import {privateGet} from './preview-access.mjs';
import {writeFile, readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

// Inspect raw responses, including the RSC stream; a closed details element is
// still exposed. Save counts only, never response bodies or real source payloads.
const forbidden=['diagnostic-private-provenance-canary','"provenance"','"series"','"daily"','"night_recovery"','"parameters"','"results"','"payload"'];
function inspect(body,label) {
  const normalized=body.replaceAll('\\"','"').replaceAll('&quot;','"');
  for(const token of forbidden) assert.ok(!normalized.includes(token),`${label}: exposed ${token}`);
}
async function bundles(dir) {
  const paths=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) paths.push(...await bundles(file));
    else if(file.endsWith('.js')) paths.push(file);
  }
  return paths;
}
export async function auditDiagnostic(page,dir,label) {
  const html=await privateGet(page.request,page.url());assert.equal(html.status(),200);
  inspect(await html.text(),'HTML (including embedded RSC)');
  assert.equal(await page.locator('main pre').count(),0);
  const rsc=await privateGet(page.request,page.url(),{RSC:'1'});
  assert.equal(rsc.status(),200);assert.ok(rsc.headers()['content-type'].includes('text/x-component'));
  inspect(await rsc.text(),'RSC');
  const remote=new URL(page.url()).hostname.endsWith('.vercel.app');
  const files=remote ? [] : await bundles('apps/web/.next/static');
  const deployed=remote ? (await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.src))).filter(url=>new URL(url).origin===new URL(page.url()).origin && new URL(url).pathname.startsWith('/_next/')) : [];
  for(const url of deployed) {
    const response=await privateGet(page.request,url);
    assert.equal(response.status(),200);
    const body=await response.text();
    for(const token of ['diagnostic-private-provenance-canary','agriclimax_read_daily','SUPABASE_SECRET_KEY','Résultat structuré et provenance source']) assert.ok(!body.includes(token),'deployed client bundle');
  }
  assert.ok(files.length+deployed.length);
  for(const file of files) {
    const body=await readFile(file,'utf8');
    for(const token of ['diagnostic-private-provenance-canary','agriclimax_read_daily','SUPABASE_SECRET_KEY','Résultat structuré et provenance source']) assert.ok(!body.includes(token),`client bundle: ${token}`);
  }
  await writeFile(`${dir}/privacy-${label}.json`,JSON.stringify({passed:true,html:true,rsc:true,no_raw_json:true,client_bundle_files:files.length,deployed_bundle_files:deployed.length,forbidden_fields:forbidden},null,2));
}
