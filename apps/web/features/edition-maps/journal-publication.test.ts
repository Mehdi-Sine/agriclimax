import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, expect, it, vi} from "vitest";
vi.mock("server-only", () => ({}));
import {readArchivedMaps} from "../../../../scripts/edit03_archives";
import {insertExact, mapObjectStore} from "../../lib/server/immutable-map-storage";
import {journalObjectStore, s3JournalStore} from "../../lib/server/journal-object-storage";
import {GET} from "../../app/api/journal/thumbnail/route";
import {localJournalStore} from "../../lib/server/journal-local-storage";
import {publishJournal} from "../../../../scripts/opti01_journal_projection";
import {publishedJournalCards, readJournalPublication, readJournalThumbnail} from "../../lib/server/journal-publication";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("publishes verified WebP and its index once, preserving edition and map identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "journal-publication-"));
  try {
    const store = localJournalStore(root);
    const {archive,bundle} = readArchivedMaps("2026-11-13");
    const id = archive.edition_id;
    expect(await publishJournal(archive,bundle,store,false)).toMatchObject({status:"simulation"});
    expect(await readJournalPublication(id,store)).toBeNull();
    await expect(publishJournal(archive,{...bundle,edition_date:"2026-11-12"},store)).rejects.toThrow("JOURNAL_MAP_BINDING");
    const first = await publishJournal(archive,bundle,store);
    expect(first).toMatchObject({status:"published"});
    const restartedStore = localJournalStore(root);
    const publication = (await readJournalPublication(id,restartedStore))!;
    const cards = publishedJournalCards(publication.edition,publication)!;
    expect(cards.map(card => card.map_id)).toEqual(publication.thumbnails.map(t => t.map_id));
    expect(publishedJournalCards({...publication.edition,checksum:"0".repeat(64)},publication)).toBeNull();
    const ref = publication.thumbnails[0];
    expect(cards[0].thumbnail_url).toContain(ref.sha256);
    expect(await readJournalThumbnail(publication,ref.map_id,"0".repeat(64),restartedStore)).toBeNull();
    const webp = Buffer.from((await readJournalThumbnail(publication,ref.map_id,ref.sha256,restartedStore))!);
    expect(webp.toString("ascii",8,12)).toBe("WEBP");
    vi.stubEnv("AGRICLIMAX_JOURNAL_PROJECTION_ENABLED","true");
    vi.stubEnv("AGRICLIMAX_JOURNAL_STORE","local");
    vi.stubEnv("AGRICLIMAX_JOURNAL_LOCAL_DIRECTORY",root);
    const url = new URL(cards[0].thumbnail_url, "https://journal.example.invalid");
    const response = await GET(new Request(url));
    expect(response.headers.get("etag")).toBe(`"${ref.sha256}"`);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(webp);
    expect((await GET(new Request(url,{headers:{"If-None-Match":`"${ref.sha256}"`}}))).status).toBe(304);
    url.searchParams.delete("sha");
    url.searchParams.set("cached","1");
    const report = await GET(new Request(url));
    expect(report.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await report.arrayBuffer())).toEqual(webp);
    expect(await publishJournal(archive,bundle,restartedStore)).toMatchObject({status:"already_published"});
    await writeFile(join(root,"journal/v1",id,ref.map_id,`${ref.sha256}.webp`), Buffer.alloc(webp.length));
    await expect(readJournalThumbnail(publication,ref.map_id,ref.sha256,restartedStore)).rejects.toThrow("JOURNAL_THUMBNAIL_CHECKSUM");
    url.searchParams.delete("cached");
    url.searchParams.set("sha",ref.sha256);
    expect((await GET(new Request(url,{headers:{"If-None-Match":`"${ref.sha256}"`}}))).status).toBe(304);
    expect((await GET(new Request(url))).status).toBe(503);
    await expect(publishJournal(archive,bundle,restartedStore,false)).rejects.toThrow("JOURNAL_THUMBNAIL_CHECKSUM");
  } finally {await rm(root,{recursive:true,force:true});}
}, 30_000);

it("uses signed, conditional S3 writes and restores the Supabase default", async () => {
  const objects = new Map<string, ArrayBuffer>();
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const headers = request.headers;
    expect(headers.get("authorization")).toContain("/auto/s3/aws4_request");
    expect(url.hostname).toBe("private-s3.example.invalid");
    expect(url.pathname).toMatch(/^\/test-bucket\/journal\/v1\//);
    if (request.method === "PUT") {
      expect(headers.get("if-none-match")).toBe("*");
      expect(headers.get("authorization")).toContain("if-none-match");
      if (objects.has(url.pathname)) return new Response(null,{status:412});
      objects.set(url.pathname,await request.arrayBuffer());
      return new Response(null);
    }
    const body = objects.get(url.pathname);
    return body ? new Response(body) : new Response(null,{status:404});
  }));
  const store = s3JournalStore({
    AGRICLIMAX_JOURNAL_S3_ENDPOINT:"https://private-s3.example.invalid",
    AGRICLIMAX_JOURNAL_S3_BUCKET:"test-bucket",
    AGRICLIMAX_JOURNAL_S3_ACCESS_KEY_ID:"test-access",
    AGRICLIMAX_JOURNAL_S3_SECRET_ACCESS_KEY:"test-secret",
  });
  const path = `journal/v1/${"1".repeat(64)}/index.json`;
  await insertExact(store,path,Buffer.from("{}"),16);
  await store.insert(path,Buffer.from("other"));
  expect(Buffer.from((await store.read(path,16))!).toString()).toBe("{}");
  await expect(store.read(path,1)).rejects.toThrow("JOURNAL_S3_BUDGET");
  vi.stubEnv("AGRICLIMAX_JOURNAL_STORE","supabase");
  expect(journalObjectStore()).toBe(mapObjectStore);
});
