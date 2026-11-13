// Real November 11 edition and frozen inputs. No fabricated operational data or remote writes.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {chromium} from "./node_modules/playwright/index.mjs";
import path from "node:path";
const origin=process.env.INT01_ORIGIN??"http://127.0.0.1:3000";
const out=process.env.INT01_ARTIFACTS??"docs/codex/INT-01/evidence/browser";
const candidate=JSON.parse(await readFile("docs/codex/INT-01/evidence/candidate-report.json","utf8"));
const edition=candidate.edition_id;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??"/usr/bin/chromium",args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
await mkdir(out,{recursive:true});
const report=[];
async function ready(page){await page.locator('[data-ready="true"][data-feature-count="713"]').waitFor({timeout:90000});}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
try{
  for(const [name,width,height] of [["desktop",1440,1000],["tablet",768,1024],["mobile",390,844],["mobile-small",360,780]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce"}),page=await context.newPage();
    const errors=[],external=[];
    page.on("pageerror",e=>errors.push(e.message));
    await context.route("**/*",async route=>{const url=new URL(route.request().url());if(url.origin!==new URL(origin).origin){external.push(url.origin);await route.abort();}else await route.continue();});
    try{
      await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:90000});
      assert.equal(new URL(page.url()).pathname,"/","UX-03 renders the Journal directly on the homepage");
      await page.waitForFunction(()=>document.querySelectorAll('.journal-thumbnail[data-state="ready"]').length===10,{},{timeout:90000});
      assert.equal(await page.locator(".journal-map-card").count(),10);
      assert.equal(await page.locator(".maplibregl-canvas").count(),0,"The Journal uses raster previews");
      assert.match(await page.locator("body").innerText(),/RECETTE.*non publiées/);
      await noOverflow(page);
      await page.screenshot({path:path.join(out,`${name}-journal.png`),fullPage:true,animations:"disabled"});
      // Follow the real thumbnail into the interactive archive before testing PRA selection.
      const link=page.locator(".journal-map-card-link").first();
      const linked=new URL(await link.getAttribute("href"),origin);
      assert.equal(linked.searchParams.get("id"),edition);
      await link.click();await page.waitForURL("**/cartes-du-jour?**");await ready(page);await noOverflow(page);
      const picker=page.getByRole("combobox",{name:"PRA de l’édition",exact:true});
      assert.equal(await picker.locator("option").count(),714);
      // Breton coastal support is deliberately missing, without imputation.
      const options=await picker.locator("option").evaluateAll(os=>os.map(o=>({value:o.value,label:o.textContent})));
      const coastal=options.find(o=>/CROZON/i.test(o.label));assert.ok(coastal);
      await picker.selectOption(coastal.value);
      await page.getByRole("complementary",{name:"PRA sélectionnée"}).getByText("Valeur non évaluable",{exact:true}).waitFor();
      await picker.selectOption("pra:2A258");
      await page.getByRole("complementary",{name:"PRA sélectionnée"}).getByText("LITTORAL CORSE - 2A",{exact:true}).waitFor();
      assert.match(await page.getByRole("complementary",{name:"PRA sélectionnée"}).innerText(),/Couverture surfacique/);
      if(name==="desktop"||name==="mobile"){
        await ready(page);await page.locator(".journal-pra-map").screenshot({path:path.join(out,`${name}-cartes-corse.png`),animations:"disabled"});
      }
      const rain=candidate.maps.find(m=>m.indicator==="rain"&&m.nature==="reanalysis");
      await page.getByRole("combobox",{name:"Indicateur de l’édition",exact:true}).selectOption(rain.id);await ready(page);
      assert.equal(await page.locator(".journal-pra-map").getAttribute("data-map-id"),rain.id);
      assert.match(await page.locator(".journal-pra-map").innerText(),/Pluie cumulée/);
      const response=await context.request.get(`${origin}/api/journal/maps?id=${edition}&map=${rain.id}`),json=await response.json();
      assert.equal(json.publication_state,"preview");assert.equal(json.map.rows.length,713);assert.deepEqual(json.map.period,["2026-10-29","2026-11-04"]);
      assert.equal(json.edition_checksum,candidate.edition_checksum);
      const forecast=candidate.maps.find(m=>m.indicator==="temperature_mean"&&m.nature==="forecast");
      await page.getByRole("combobox",{name:"Indicateur de l’édition",exact:true}).selectOption(forecast.id);await ready(page);
      await page.getByRole("combobox",{name:"PRA de l’édition",exact:true}).selectOption("pra:2B258");await ready(page);
      assert.match(await page.locator(".journal-pra-map").innerText(),/2026-11-11 → 2026-11-12/);
      assert.match(await page.locator(".pra-source").innerText(),/9 novembre 2026/);
      await noOverflow(page);await page.screenshot({path:path.join(out,`${name}-cartes-du-jour.png`),fullPage:true,animations:"disabled"});
      // Click a visible mainland polygon, using actual rendered canvas coordinates.
      const canvas=page.locator("canvas.maplibregl-canvas");const box=await canvas.boundingBox();assert.ok(box);
      await canvas.click({position:{x:box.width*.48,y:box.height*.43}});await ready(page);
      const clicked=await page.getByRole("combobox",{name:"PRA de l’édition",exact:true}).inputValue();
      assert.ok(clicked);assert.notEqual(clicked,"pra:2B258","A rendered mainland polygon must update the PRA selection");
      if(name==="desktop"){
        await page.goto(origin+"/journal?date=2026-11-10",{waitUntil:"domcontentloaded",timeout:90000});
        await page.getByRole("heading",{name:"Pas de carte opérationnelle publiée",exact:true}).waitFor();
        assert.equal(await page.locator(".edition-maps canvas").count(),0);
        await page.screenshot({path:path.join(out,"desktop-archive-absent.png"),fullPage:true});
        await page.goto(origin+`/cartes-du-jour?id=${edition}`,{waitUntil:"domcontentloaded",timeout:90000});
        // Failure recipe changes transport availability only; it never substitutes map values.
        await context.route("**/api/journal/maps?*",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({status:"error",code:"RECIPE_TRANSPORT_UNAVAILABLE"})}));
        await page.reload({waitUntil:"domcontentloaded"});await page.getByRole("alert").getByText(/Carte indisponible ou contours incompatibles/).waitFor();
        await page.screenshot({path:path.join(out,"desktop-map-unavailable.png"),fullPage:true});
      }
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
      report.push({name,width,height,status:"passed",official_geometries:713,corsican_pra:6,edition_id:edition,bundle_sha256:candidate.bundle_sha256,publication_state:"preview",external_requests:0,overflow:false});
    }finally{await context.close();}
  }
}finally{await browser.close();await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));}
console.log(`INT-01: ${report.length} viewports verified with real unpublished maps`);
