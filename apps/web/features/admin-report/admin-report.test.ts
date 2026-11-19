import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReport } from "./report";
import { renderReport } from "./render";
import { date, scenarios } from "./scenarios";
import { authorizedReport, deliverReport } from "./delivery";
import { editorialRPC } from "../editorial-ai/supabase-store";
import { checkJournal } from "../nightly/journal-health";

vi.mock("server-only",()=>({}));
vi.mock("../editorial-ai/supabase-store",()=>({editorialRPC:vi.fn()}));
vi.mock("../nightly/journal-health",()=>({
  checkJournal:vi.fn(),journalOrigin:()=>new URL("https://example.com"),
}));
const store = vi.mocked(editorialRPC);
const verify = vi.mocked(checkJournal);
const before = new Date("2026-11-19T06:29:59Z");
const winterDeadline = new Date("2026-11-19T06:30:00Z");
const summerDeadline = new Date("2026-07-19T05:30:00Z");
const identity = {id:"a".repeat(64),checksum:"c".repeat(64),shared:true};
const nominal = scenarios.nominal;

describe("rapport Climacta",()=>{
  it.each([
    ["nominal","VERT","Aucune intervention nécessaire"],
    ["source-secondaire","ORANGE","3 tentatives"],
    ["secours-factuel","ORANGE","Secours factuel"],
    ["edition-absente","ROUGE","Préparation en cours"],
  ])("rend %s en HTML et texte", (name,status,phrase)=>{
    const {data,edition} = scenarios[name];
    const mail = renderReport(buildReport(date,data,edition,"https://example.com"));
    expect(mail.subject).toBe(`Climacta · ${status} · ${date}`);
    expect(mail.html).toContain(phrase);
    expect(mail.text).toContain(phrase);
    expect(mail.html.includes("/journal?date=")).toBe(Boolean(edition));
    expect(mail.html).not.toContain("cid:");
  });

  it("échappe le titre et utilise uniquement la miniature fournie",()=>{
    const edition = {...nominal.edition!,title:"<script>alert(1)</script>",hero:"b".repeat(64)};
    const {html,text} = renderReport(buildReport(date,nominal.data,edition,"https://example.com",true));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("cid:climacta-carte");
    expect(text).not.toContain("cid:");
  });
});

describe("envoi",()=>{
  let saved: string | undefined;
  let sent: boolean;
  let dropAck: boolean;
  beforeEach(()=>{
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY","resend-synthetic");
    vi.stubEnv("AGRICLIMAX_ADMIN_FROM","rapports@example.com");
    vi.stubEnv("AGRICLIMAX_ADMIN_EMAIL","admin@example.com");
    saved=undefined; sent=false; dropAck=false;
    store.mockImplementation(async (action,input)=>{
      const payload = input as {message:string};
      switch(action) {
        case "admin_report:outbox": return sent ? {status:"sent"} : saved ? {status:"reserved",message:saved} : {status:"new"};
        case "admin_report:diagnostics": return nominal.data;
        case "admin_report:edition": return nominal.edition;
        case "admin_report:reserve": saved ??= payload.message; return {status:"reserved",message:saved};
        case "admin_report:accept":
          if(dropAck) {dropAck=false; throw Error("lost acknowledgment");}
          sent=true; return {status:"sent"};
        default: throw Error(action);
      }
    });
  });
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

  it("exige une seule adresse et un jeton correct",async ()=>{
    expect(authorizedReport(null,"t".repeat(32))).toBe(false);
    expect(authorizedReport(`Bearer ${"t".repeat(32)}`,"t".repeat(32))).toBe(true);
    expect(authorizedReport(`Bearer ${"u".repeat(32)}`,"t".repeat(32))).toBe(false);
    vi.stubEnv("AGRICLIMAX_ADMIN_EMAIL","admin@example.com,other@example.com");
    await expect(deliverReport(before)).rejects.toThrow("ADMIN_REPORT_CONFIGURATION");
    expect(store).not.toHaveBeenCalled();
  });

  it("attend tant que la publication est absente avant 07 h 30",async ()=>{
    verify.mockResolvedValue(null);
    const transport=vi.fn();
    vi.stubGlobal("fetch",transport);
    expect(await deliverReport(before)).toBe("waiting");
    expect(transport).not.toHaveBeenCalled();
    expect(saved).toBeUndefined();
  });

  it.each([winterDeadline,summerDeadline])("envoie ROUGE dès 07 h 30 Paris (%s)",async now=>{
    verify.mockResolvedValue(null);
    const transport=vi.fn(async ()=>Response.json({id:"receipt-1"}));
    vi.stubGlobal("fetch",transport);
    expect(await deliverReport(now)).toBe("sent");
    expect(JSON.parse(saved!).subject).toContain("ROUGE");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("envoie immédiatement une édition vérifiée et déduplique la concurrence et la perte du reçu",async ()=>{
    verify.mockResolvedValue(identity);
    dropAck=true;
    const accepted=new Map<string,string>();
    const transport=vi.fn(async (_url: string, options: RequestInit)=>{
      const key=new Headers(options.headers).get("Idempotency-Key")!;
      const body=options.body as string;
      if(accepted.has(key)) expect(body).toBe(accepted.get(key));
      accepted.set(key,body);
      return Response.json({id:"receipt-1"});
    });
    vi.stubGlobal("fetch",transport);
    const results=await Promise.allSettled([deliverReport(before),deliverReport(before)]);
    expect(results.some(r=>r.status==="fulfilled" && r.value==="sent")).toBe(true);
    expect(accepted.size).toBe(1);
    expect(JSON.parse(saved!).to).toEqual(["admin@example.com"]);
    const attempts=transport.mock.calls.length;
    expect(await deliverReport(winterDeadline)).toBe("sent");
    expect(transport).toHaveBeenCalledTimes(attempts);
  });
});
