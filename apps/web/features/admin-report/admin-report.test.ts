import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReport } from "./report";
import { renderReport } from "./render";
import { date, scenarios } from "./scenarios";
import { authorizedReport, deliverReport } from "./delivery";
import { editorialRPC } from "../editorial-ai/supabase-store";
import { POST } from "../../app/api/internal/admin-report/route";
import { checkJournal } from "../nightly/journal-health";

vi.mock("server-only",()=>({}));
vi.mock("../editorial-ai/supabase-store",()=>({editorialRPC:vi.fn()}));
vi.mock("../nightly/journal-health",()=>({
  checkJournal:vi.fn(),journalOrigin:()=>new URL("https://example.com"),
}));
const { createTransport, sendMail, verifySmtp } = vi.hoisted(() => ({
  createTransport: vi.fn(), sendMail: vi.fn(), verifySmtp: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
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
    ["edition-absente","ROUGE","Briefing en cours"],
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

describe("envoi SMTP", () => {
  let claimId: string | undefined;
  let sent: boolean;
  let dropAck: boolean;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "rapports@example.com");
    vi.stubEnv("SMTP_PASS", "synthetic password");
    vi.stubEnv("AGRICLIMAX_ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("AGRICLIMAX_ADMIN_REPORT_TOKEN", "t".repeat(32));
    createTransport.mockReturnValue({ sendMail, verify: verifySmtp });
    sendMail.mockResolvedValue({ accepted: ["admin@example.com"], rejected: [] });
    verifySmtp.mockResolvedValue(true);
    claimId = undefined;
    sent = false;
    dropAck = false;
    store.mockImplementation(async (action, input) => {
      const payload = input as {claim_id: string};
      switch (action) {
        case "admin_report:outbox": return {status: sent ? "sent" : claimId ? "uncertain" : "new"};
        case "admin_report:diagnostics": return nominal.data;
        case "admin_report:edition": return nominal.edition;
        case "admin_report:smtp_claim":
          if (sent || claimId) return {status: sent ? "sent" : "uncertain"};
          claimId = payload.claim_id;
          return {status: "claimed"};
        case "admin_report:smtp_accept":
          expect(payload.claim_id).toBe(claimId);
          if (dropAck) throw Error("lost database acknowledgment");
          sent = true;
          return {status: "sent"};
        default: throw Error(action);
      }
    });
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("exige une seule adresse et un jeton correct", async () => {
    expect(authorizedReport(null)).toBe(false);
    expect(authorizedReport(`Bearer ${"t".repeat(32)}`)).toBe(true);
    expect(authorizedReport(`Bearer ${"u".repeat(32)}`)).toBe(false);
    vi.stubEnv("AGRICLIMAX_ADMIN_EMAIL", "admin@example.com,other@example.com");
    await expect(deliverReport(before)).rejects.toThrow("ADMIN_REPORT_CONFIGURATION");
    expect(store).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("vérifie STARTTLS et l’authentification sur la route privée sans toucher au registre", async () => {
    const url = "https://example.com/api/internal/admin-report?verify=smtp";
    expect((await POST(new Request(url, {method: "POST"}))).status).toBe(404);
    expect(verifySmtp).not.toHaveBeenCalled();
    const request = new Request(url, {method: "POST", headers: {authorization: `Bearer ${"t".repeat(32)}`}});
    const response = await POST(request);
    expect(await response.json()).toEqual({status: "smtp_verified"});
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true,
      auth: {user: "rapports@example.com", pass: "syntheticpassword"},
      disableFileAccess: true, disableUrlAccess: true,
    }));
    expect(verifySmtp).toHaveBeenCalledOnce();
    expect(sendMail).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it("attend tant que la publication est absente avant 07 h 30", async () => {
    verify.mockResolvedValue(null);
    expect(await deliverReport(before)).toBe("waiting");
    expect(sendMail).not.toHaveBeenCalled();
    expect(claimId).toBeUndefined();
  });

  it.each([winterDeadline, summerDeadline])("envoie ROUGE dès 07 h 30 Paris (%s)", async now => {
    verify.mockResolvedValue(null);
    expect(await deliverReport(now)).toBe("sent");
    expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      subject: expect.stringContaining("ROUGE"),
      from: {name: "Climacta", address: "rapports@example.com"},
      to: "admin@example.com",
    }));
    expect(await deliverReport(now)).toBe("sent");
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("envoie une seule fois une édition vérifiée malgré deux revendications concurrentes", async () => {
    verify.mockResolvedValue(identity);
    const results = await Promise.allSettled([deliverReport(before), deliverReport(before)]);
    expect(results).toContainEqual({status: "fulfilled", value: "sent"});
    expect(store.mock.calls.filter(([action]) => action === "admin_report:smtp_claim")).toHaveLength(2);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0].messageId).toContain(claimId);
  });

  it("préserve la miniature intégrée, le HTML et le texte", async () => {
    verify.mockResolvedValue(identity);
    const hero = "b".repeat(64);
    store.mockImplementationOnce(async () => ({status: "new"}))
      .mockImplementationOnce(async () => nominal.data)
      .mockImplementationOnce(async () => ({...nominal.edition, hero}));
    const image = Buffer.from([1, 2, 3]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(image, {headers: {"Content-Type": "image/webp"}})));
    expect(await deliverReport(before)).toBe("sent");
    expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      text: expect.stringContaining("Aucune intervention nécessaire"),
      html: expect.stringContaining("cid:climacta-carte"),
      attachments: [{filename: "carte.webp", cid: "climacta-carte", content: image, contentType: "image/webp"}],
    }));
  });

  it("ne soumet aucun message si la réponse de la réservation est perdue", async () => {
    verify.mockResolvedValue(identity);
    const ledger = store.getMockImplementation()!;
    store.mockImplementation(async (action, input) => {
      const result = await ledger(action, input);
      if (action === "admin_report:smtp_claim") throw Error("claim committed, response lost");
      return result;
    });
    await expect(deliverReport(before)).rejects.toThrow("claim committed, response lost");
    await expect(deliverReport(winterDeadline)).rejects.toThrow("ADMIN_REPORT_RECONCILIATION_REQUIRED");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each(["smtp", "database"])("bloque toute nouvelle tentative après la perte du reçu %s", async failure => {
    verify.mockResolvedValue(identity);
    if (failure === "smtp") sendMail.mockRejectedValueOnce(Error("connection lost after DATA"));
    else dropAck = true;
    await expect(deliverReport(before)).rejects.toThrow("ADMIN_REPORT_RECONCILIATION_REQUIRED");
    await expect(deliverReport(winterDeadline)).rejects.toThrow("ADMIN_REPORT_RECONCILIATION_REQUIRED");
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sent).toBe(false);
  });
});
