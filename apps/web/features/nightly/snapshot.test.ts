import { describe, expect, it } from "vitest";
import { cutoffUTC, parisClock, selectCycles, freezeSnapshot, verifySnapshot, type Cycle } from "./snapshot";
const cycle=(extra: Partial<Cycle> = {}):Cycle=>({provider:"ecmwf",model:"ifs",emitted_at:"2026-11-08T06:00:00Z",acquired_at:"2026-11-08T07:00:00Z",valid_dates:["2026-11-09","2026-11-10"],variables:["temperature_min","temperature_max","precipitation"],pra_count:713,quality:"qualified",continuity:true,archive:{path:"weather/abc",sha256:"a".repeat(64)},source_version:"pra-national-weather-daily-1",support_qualification:["CORE-01","partial_and_unavailable_preserved"],...extra});
describe("nightly scientific selection",()=>{
 it("retains a yesterday cycle with actual emission time",()=>{const c=cycle(); const r=selectCycles([c],"2026-11-09",cutoffUTC("2026-11-09"));expect(r.quality).toBe("fallback_valid");expect(r.sources[0].emitted_at).toBe(c.emitted_at);});
 it.each([
  {valid_dates:["2026-11-08"]}, {quality:"quarantined" as const}, {continuity:false},
  {pra_count:12}, {support_qualification:[]}, {variables:["humidity"]},
  {emitted_at:"2026-11-01T00:00:00Z"}, {acquired_at:"2026-11-09T06:00:00Z"},
  {source_version:"fixture-1"},
 ])("rejects unusable forecast %j", change=>{expect(selectCycles([cycle(change)],"2026-11-09",cutoffUTC("2026-11-09")).quality).toBe("insufficient");});
 it("prefers a new qualified cycle and falls back past a corrupt newer one",()=>{
  const fresh=cycle({emitted_at:"2026-11-09T00:00:00Z",acquired_at:"2026-11-09T01:00:00Z",archive:{path:"weather/new",sha256:"b".repeat(64)}});
  expect(selectCycles([cycle(),fresh],"2026-11-09",cutoffUTC("2026-11-09")).quality).toBe("fresh");
  expect(selectCycles([cycle(),{...fresh,quality:"quarantined"}],"2026-11-09",cutoffUTC("2026-11-09")).quality).toBe("fallback_valid");
 });
 it("does not mutate the frozen dossier when late inputs arrive",()=>{const s=freezeSnapshot("2026-11-09",[],null,"2026-11-09T05:00:00Z");verifySnapshot(s);s.limitations.push("tampered");expect(()=>verifySnapshot(s)).toThrow("SNAPSHOT_INTEGRITY");});
 it("insufficient dossier has no payable briefing",()=>{const s=freezeSnapshot("2026-11-09",[cycle()],null,"2026-11-09T05:00:00Z");expect(s.quality).toBe("insufficient");expect(s.briefing).toBeNull();});
 it("rejects preparation before cutoff",()=>expect(()=>freezeSnapshot("2026-11-09",[],null,"2026-11-09T03:00:00Z")).toThrow("FREEZE_BEFORE_CUTOFF"));
});
describe("Paris DST and recovery",()=>{
 it("has exactly one cutoff on the spring skipped-hour date",()=>expect(cutoffUTC("2026-03-29")).toBe("2026-03-29T03:40:00.000Z"));
 it("has exactly one cutoff on the autumn repeated-hour date",()=>expect(cutoffUTC("2026-10-25")).toBe("2026-10-25T04:40:00.000Z"));
 it("maps repeated clocks to one editorial date",()=>{expect(parisClock(new Date("2026-10-25T00:15:00Z"))).toBe("02:15");expect(parisClock(new Date("2026-10-25T01:15:00Z"))).toBe("02:15");});
 it("recovers the skipped 02:15 slot at 03:15",()=>expect(parisClock(new Date("2026-03-29T01:15:00Z"))).toBe("03:15"));
});
