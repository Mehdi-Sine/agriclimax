import assert from 'node:assert/strict';

export async function mapControls(page) {
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('href'),'#main','skip link is first in tab order');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'main');
  const map=page.locator('.live-map');
  const initial=await map.getAttribute('viewBox');
  await page.getByRole('button',{name:'Agrandir la carte',exact:true}).click();
  assert.notEqual(await map.getAttribute('viewBox'),initial);
  await map.focus();await page.keyboard.press('ArrowRight');
  const moved=await map.getAttribute('viewBox');
  await page.getByRole('button',{name:'Déplacer vers le sud',exact:true}).click();
  assert.notEqual(await map.getAttribute('viewBox'),moved);
  const beforeDrag=await map.getAttribute('viewBox');
  await map.scrollIntoViewIfNeeded();
  const area=await map.boundingBox();
  if(page.viewportSize().width===390) {
    // Touch events, not just a desktop mouse in a narrow viewport.
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const touchPoints=[{x:area.x+area.width/2,y:area.y+area.height/2}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchPoints[0].x+30,y:touchPoints[0].y+20}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  } else {
    await page.mouse.move(area.x+area.width/2,area.y+area.height/2);
    await page.mouse.down();await page.mouse.move(area.x+area.width/2+30,area.y+area.height/2+20,{steps:5});await page.mouse.up();
  }
  assert.notEqual(await map.getAttribute('viewBox'),beforeDrag,'pointer pan must change the view');
  await page.getByRole('button',{name:'Recentrer sur la France',exact:true}).click();
  assert.equal(await map.getAttribute('viewBox'),initial);
  await page.keyboard.press('Control+Home');
}

export async function historyAndLatest(page) {
  const current=new URL(page.url());
  const link=new URL(await page.getByRole('navigation',{name:'Dernière publication',exact:true}).getByRole('link').getAttribute('href'),page.url());
  assert.equal(link.pathname,current.pathname);
  for(const key of ['production','indicator','station','product','stage','fingerprint']) assert.equal(link.searchParams.get(key),current.searchParams.get(key));
  assert.ok(!link.searchParams.has('start') && !link.searchParams.has('end'));
  const url=page.url();
  const timing=await page.evaluate(()=>{
    const n=performance.getEntriesByType('navigation')[0];
    return {ttfb_ms:Math.round(n.responseStart-n.startTime),response_ms:Math.round(n.responseEnd-n.startTime),decoded_bytes:n.decodedBodySize,transfer_bytes:n.transferSize};
  });
  await page.goBack({waitUntil:'networkidle'});
  await page.goForward({waitUntil:'networkidle'});
  assert.equal(page.url(),url,'browser back/forward must keep exact selected URL');
  return timing;
}
