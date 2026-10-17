import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewHeaders,protectPreviewContext} from './preview-access.mjs';
test('bypass header is restricted to exact HTTPS preview origin',()=>{
 const previous=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
 process.env.VERCEL_AUTOMATION_BYPASS_SECRET='synthetic-test-value';
 try {
  const origin='https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app';
  assert.equal(previewHeaders(origin+'/diagnostic')['x-vercel-protection-bypass'],'synthetic-test-value');
  for(const url of ['http://127.0.0.1:3000','https://vercel.com/sso-api','https://example.com',origin+'.example.com',origin.replace('https:','http:')]) assert.deepEqual(previewHeaders(url),{});
 } finally {if(previous===undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;else process.env.VERCEL_AUTOMATION_BYPASS_SECRET=previous;}
});
test('interception strips inherited bypass and disables redirect forwarding',async()=>{
 let handler;
 await protectPreviewContext({route:async(_pattern,callback)=>{handler=callback;}});
 let options;
 await handler({request:()=>({headers:()=>({'x-vercel-protection-bypass':'synthetic'}),url:()=> 'https://example.com'}),fetch:async o=>{options=o;return {};},fulfill:async()=>{}});
 assert.deepEqual(options,{headers:{},maxRedirects:0});
});
test('request failures withhold credential-bearing tool details',async()=>{
 const {privateGet}=await import('./preview-access.mjs');
 await assert.rejects(privateGet({get:async()=>{throw new Error('sensitive request details');}},'https://example.com'),error=>!error.message.includes('sensitive request details'));
});
