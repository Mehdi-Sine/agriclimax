import "server-only";

export const DEFAULT_ORIGIN = "https://agriclimax.vercel.app";
const digest = (value: unknown): value is string => typeof value==="string" && /^[a-f0-9]{64}$/.test(value);
export function journalOrigin() {
  const url = new URL(process.env.AGRICLIMAX_JOURNAL_HEALTH_URL || DEFAULT_ORIGIN);
  if(url.protocol!=="https:" || url.username || url.password || url.pathname!=="/" || url.search || url.hash)
    throw Error("HEALTH_URL_ORIGIN");
  return url;
}
export async function checkJournal(date?: string) {
  const origin = journalOrigin();
  const headers: Record<string,string> = {};
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if(secret) headers["x-vercel-protection-bypass"]=secret;
  const request = (path: string) => fetch(new URL(path,origin), {
    cache:"no-store", redirect:"error", signal:AbortSignal.timeout(6000), headers,
  });
  try {
    const [response,page] = await Promise.all([request("/api/journal/availability"),request(date ? `/journal?date=${date}` : "/journal")]);
    const data: {date?: string; checksum?: unknown; edition_id?: unknown; storage?: string} = await response.json();
    if(!response.ok || !page.ok || (date && data.date!==date) || !digest(data.edition_id) || !digest(data.checksum))
      return null;
    return {id:data.edition_id,checksum:data.checksum,shared:data.storage==="shared_archive"};
  } catch { return null; }
}
