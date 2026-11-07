// Native Node fetch honours the managed Cloud proxy; Playwright route.fetch does not.
// Keep bypass credentials on the exact explicitly selected Preview origin, never on redirects.
export async function protectTask30Preview(context,origin){
 if(!origin.startsWith('https:'))return;
 const selected=new URL(origin);
 if(!selected.hostname.endsWith('.vercel.app'))throw new Error('Unsupported Preview origin');
 await context.route('**/*',async route=>{
  try{
   const request=route.request(),headers={...request.headers()};delete headers['x-vercel-protection-bypass'];
   if(new URL(request.url()).origin===selected.origin&&process.env.VERCEL_AUTOMATION_BYPASS_SECRET)headers['x-vercel-protection-bypass']=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
   const method=request.method();
   const response=await fetch(request.url(),{method,headers,...(!['GET','HEAD'].includes(method)?{body:request.postDataBuffer()}:{}),redirect:'manual',signal:AbortSignal.timeout(60000)});
   const responseHeaders=Object.fromEntries(response.headers.entries());
   delete responseHeaders['content-encoding'];delete responseHeaders['content-length'];delete responseHeaders['transfer-encoding'];
   await route.fulfill({status:response.status,headers:responseHeaders,body:Buffer.from(await response.arrayBuffer())});
  }catch{await route.abort('failed').catch(()=>{});}
 });
}
