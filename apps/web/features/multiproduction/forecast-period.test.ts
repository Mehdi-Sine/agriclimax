import {it,expect} from "vitest";
import {homogeneousForecastPeriod} from "./forecast-period";
const row=(valid_date:string,model_run_at:string,model="arome")=>({valid_date,model_run_at,model,source_id:model});
const timeline=(rows:ReturnType<typeof row>[])=>({rows,selected_indices:rows.map((_,i)=>i)});
it("preserves an already homogeneous edition-day window",()=>{
 expect(homogeneousForecastPeriod(timeline([row("2026-11-11","2026-11-09T12:00:00Z"),row("2026-11-12","2026-11-09T12:00:00Z")]),"2026-11-11")).toEqual(["2026-11-11","2026-11-12"]);
});
it("moves to explicitly dated future days instead of stitching fresh mixed runs",()=>{
 const rows=[row("2026-11-11","2026-11-11T00:00:00Z"),row("2026-11-12","2026-11-11T06:00:00Z"),row("2026-11-13","2026-11-11T06:00:00Z","arpege"),row("2026-11-14","2026-11-11T06:00:00Z","arpege")];
 expect(homogeneousForecastPeriod(timeline(rows),"2026-11-11")).toEqual(["2026-11-13","2026-11-14"]);
});
it("refuses missing dates, mixed origins in a day and absent runs",()=>{
 expect(homogeneousForecastPeriod(timeline([row("2026-11-11","run"),row("2026-11-13","run")]),"2026-11-11")).toBeNull();
 expect(homogeneousForecastPeriod(timeline([row("2026-11-11","run"),row("2026-11-11","other"),row("2026-11-12","run")]),"2026-11-11")).toBeNull();
 expect(homogeneousForecastPeriod(timeline([row("2026-11-11",""),row("2026-11-12","")]),"2026-11-11")).toBeNull();
});
