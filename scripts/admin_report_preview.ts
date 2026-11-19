import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReport } from "../apps/web/features/admin-report/report";
import { renderReport } from "../apps/web/features/admin-report/render";
import { date, scenarios } from "../apps/web/features/admin-report/scenarios";

const directory = process.argv[2] ?? "docs/codex/OPS-08/apercus";
mkdirSync(directory,{recursive:true});
for(const [name,{data,edition}] of Object.entries(scenarios)) {
  const {html} = renderReport(buildReport(date,data,edition,"https://example.com"));
  writeFileSync(join(directory,`${name}.html`),html.replace(
    '<table role="presentation" width="100%"', '<p style="text-align:center;margin:6px">Aperçu · données fictives</p><table role="presentation" width="100%"'));
}
