// UX-01: parcours et preuves visuelles du build de production (données réelles ou archive absente).
// Aucun provider externe appelé, aucune donnée de simulation injectée.
import assert from "node:assert/strict";
import {chromium} from "./node_modules/playwright/index.mjs";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const origin=process.env.UX01_ORIGIN??"http://127.0.0.1:3000";
const out=path.resolve(process.env.UX01_ARTIFACTS??"work/quality/e2e/ux01");
await mkdir(out,{recursive:true});
const sizes=[["desktop-1440",1440,900],["desktop-1280",1280,800],["tablet-768",768,1024],["mobile-390",390,844],["mobile-360",360,780]];
const expected=["Le Journal","Cartes du jour","Explorer le climat","Productions","Aide et documentation"];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const report=[];
try {
  for(const [name,width,height] of sizes){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce"});
    const page=await context.newPage();
    const problems=[];
    page.on("pageerror",()=>problems.push("pageerror"));
    try {
      for(const [key,route] of [["journal","/journal"],["documentation","/aide-et-documentation"]]){
        const response=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:45000});
        assert.equal(response?.status(),200,`Rendu ${route}`);
        await page.waitForFunction(()=>document.querySelectorAll(".editorial-nav").length===1,{},{timeout:15000});
        const nav=await page.locator(".editorial-nav a").allTextContents();
        assert.deepEqual(nav.map(s=>s.trim()),expected,"Navigation principale UX-01");
        await page.getByRole("heading",{level:1}).first().waitFor({state:"visible",timeout:15000});
        await page.waitForLoadState("load",{timeout:12000}).catch(()=>{});
        await page.screenshot({path:path.join(out,`${name}-${key}.png`),fullPage:true,animations:"disabled"});
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
        assert.equal(overflow,false,`Débordement horizontal ${name} / ${key}`);
        if(key==="documentation"){
          const search=page.getByRole("searchbox");
          await search.fill("THI");
          await page.getByText("FAQ et glossaire",{exact:true}).first().waitFor({state:"visible"});
          assert.ok((await page.locator(".ux01-doc-article section").count())>=1);
        }
        report.push({name,width,height,route,nav_count:nav.length,overflow:false});
      }
      if(width===1440){
        const home=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:45000});
        assert.ok(home?.ok(),"Accueil accessible");
        assert.equal(new URL(page.url()).pathname,"/","UX-02B renders the Journal directly on the homepage");
        assert.equal(home.request().redirectedFrom(),null,"Homepage must render without a redirect");
        for(const route of ["/cartes-du-jour","/climat","/productions"]){
          const response=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:45000});
          assert.equal(response?.status(),200,route);
          await page.waitForFunction(()=>document.querySelectorAll(".editorial-nav").length===1,{},{timeout:15000});
          const nav=await page.locator(".editorial-nav a").allTextContents();
          assert.deepEqual(nav.map(s=>s.trim()),expected);
          await page.screenshot({path:path.join(out,`desktop-1440-${route.slice(1)}.png`),fullPage:true,animations:"disabled"});
          report.push({name,route,status:200});
        }
      }
      assert.deepEqual(problems,[],`JavaScript ${name}`);
    }finally{await context.close();}
  }
}finally{
  await writeFile(path.join(out,"acceptance.json"),JSON.stringify(report,null,2));
  await browser.close();
}
console.log("UX-01: routes, navigation, documentation and responsive screenshots verified");
