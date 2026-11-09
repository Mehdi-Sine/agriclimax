import "server-only";
import { publishedEditions } from "../../features/editorial-ai/supabase-store";
import type { Archive } from "../../features/editorial-ai/model";
let previous: Archive[] = [];
/** Last accepted manifest remains readable after a generation/publication failure. */
export async function operationalEditions() {
  try { previous=await publishedEditions(); }
  catch { if(!previous.length) throw Error("PUBLISHED_ARCHIVES_UNAVAILABLE"); }
  return previous;
}
