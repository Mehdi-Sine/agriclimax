// The bypass credential must never follow redirects or leave this exact origin.
const previewOrigin='https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app';
export function previewHeaders(url) {
  const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return new URL(url).origin===previewOrigin && secret ? {'x-vercel-protection-bypass':secret} : {};
}
export async function protectPreviewContext(context) {
  await context.route('**/*',async route=>{
    const headers={...route.request().headers()};
    delete headers['x-vercel-protection-bypass'];
    Object.assign(headers,previewHeaders(route.request().url()));
    // fetch with redirects disabled: route.continue headers also follow redirects.
    let response;
    try {response=await route.fetch({headers,maxRedirects:0});}
    catch {await route.abort('failed');return;}
    await route.fulfill({response});
  });
}

export async function privateGet(request,url,headers={}) {
  const bypass=previewHeaders(url);
  // Local Next RSC canonicalization may redirect; only credential-bearing
  // requests must disable forwarding. Local/synthetic behavior stays unchanged.
  try {return await request.get(url,{headers:{...bypass,...headers},...(Object.keys(bypass).length ? {maxRedirects:0} : {})});}
  catch {throw new Error('Preview request failed; request details withheld to protect credentials.');}
}
