import "server-only";
import {localJournalStore} from "./journal-local-storage";
import {AwsClient} from "aws4fetch";
import {journalObjectPath, mapObjectStore, type MapObjectStore} from "./immutable-map-storage";

export function s3JournalStore(env: NodeJS.ProcessEnv): MapObjectStore {
  const {AGRICLIMAX_JOURNAL_S3_ENDPOINT: endpoint, AGRICLIMAX_JOURNAL_S3_BUCKET: bucket,
    AGRICLIMAX_JOURNAL_S3_REGION: region = "auto", AGRICLIMAX_JOURNAL_S3_ACCESS_KEY_ID: accessKeyId,
    AGRICLIMAX_JOURNAL_S3_SECRET_ACCESS_KEY: secretAccessKey} = env;
  if (!endpoint || !bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
      !accessKeyId || !secretAccessKey) throw Error("JOURNAL_S3_CONFIGURATION");
  const origin = new URL(endpoint);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash)
    throw Error("JOURNAL_S3_ENDPOINT");
  const client = new AwsClient({accessKeyId, secretAccessKey, region, service:"s3", retries:0});
  function location(path: string) {
    return new URL(`/${bucket}/${journalObjectPath(path)}`, origin);
  }
  return {
    async read(path, limit) {
      const response = await client.fetch(location(path), {
        cache:"no-store", redirect:"error", signal:AbortSignal.timeout(12000),
      });
      if (response.status === 404) return null;
      if (!response.ok || !response.body) throw Error("JOURNAL_S3_READ");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) {await reader.cancel(); throw Error("JOURNAL_S3_BUDGET");}
        chunks.push(value);
      }
      return Buffer.concat(chunks, size);
    },
    async insert(path, bytes) {
      const response = await client.fetch(location(path), {
        method:"PUT", body:Buffer.from(bytes), redirect:"error", signal:AbortSignal.timeout(12000),
        headers:{"If-None-Match":"*", "Content-Type": path.endsWith(".webp") ? "image/webp" : "application/json"},
        aws:{allHeaders:true},
      });
      if (!response.ok && response.status !== 412) throw Error("JOURNAL_S3_INSERT");
    },
  };
}

let s3: MapObjectStore | undefined;
export function journalObjectStore() {
  const provider = process.env.AGRICLIMAX_JOURNAL_STORE;
  if (!provider || provider === "supabase") return mapObjectStore;
  if (provider === "local") return localJournalStore(process.env.AGRICLIMAX_JOURNAL_LOCAL_DIRECTORY ?? "");
  if (provider === "s3") return s3 ??= s3JournalStore(process.env);
  throw Error("JOURNAL_STORAGE_BACKEND");
}
