import assert from 'node:assert/strict';
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
  const html=await page.request.get(page.url());assert.equal(html.status(),200);
  inspect(await html.text(),'HTML (including embedded RSC)');
  assert.equal(await page.locator('main pre').count(),0);
  const rsc=await page.request.get(page.url(),{headers:{RSC:'1'}});
  assert.equal(rsc.status(),200);assert.ok(rsc.headers()['content-type'].includes('text/x-component'));
  inspect(await rsc.text(),'RSC');
  const files=await bundles('apps/web/.next/static');
  assert.ok(files.length);
  for(const file of files) {
    const body=await readFile(file,'utf8');
    for(const token of ['diagnostic-private-provenance-canary','agriclimax_read_daily','SUPABASE_SECRET_KEY','Résultat structuré et provenance source']) assert.ok(!body.includes(token),`client bundle: ${token}`);
  }
  await writeFile(`${dir}/privacy-${label}.json`,JSON.stringify({passed:true,html:true,rsc:true,no_raw_json:true,client_bundle_files:files.length,forbidden_fields:forbidden},null,2));
}
