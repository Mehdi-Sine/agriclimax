import "server-only";
import {createHash} from "node:crypto";
import {verifyConsultable, type ConsultableEdition} from "../../features/editorial-ai/consultable";
import {journalMapCards, THUMBNAIL_VERSION} from "../../features/edition-maps/carousel-model";
import type {EditionMapsView} from "../../features/edition-maps/model";
import type {MapObjectStore} from "./immutable-map-storage";

import {journalObjectStore} from "./journal-object-storage";

export const journalObjectDigest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const sha = /^[a-f0-9]{64}$/;
export const journalIndexLimit = 512 * 1024;
export const journalThumbnailLimit = 192 * 1024;

type Thumbnail = {map_id: string; sha256: string; bytes: number};
export type JournalPublication = {
  version: "journal-publication-1";
  renderer: typeof THUMBNAIL_VERSION;
  edition: ConsultableEdition;
  view: EditionMapsView;
  thumbnails: Thumbnail[];
};

export function journalIndexPath(id: string) {
  if (!sha.test(id)) throw Error("JOURNAL_PUBLICATION_ID");
  return `journal/v1/${id}/index.json`;
}

export function journalImagePath(id: string, thumbnail: Thumbnail) {
  return `journal/v1/${id}/${thumbnail.map_id}/${thumbnail.sha256}.webp`;
}

function decode(raw: Uint8Array, id: string): JournalPublication {
  const {body, sha256} = JSON.parse(Buffer.from(raw).toString()) as {body: string; sha256: string};
  if (typeof body !== "string" || journalObjectDigest(Buffer.from(body)) !== sha256) throw Error("JOURNAL_PUBLICATION_CHECKSUM");
  const p = JSON.parse(body) as JournalPublication;
  const edition = verifyConsultable(p.edition);
  if (p.version !== "journal-publication-1" || p.renderer !== THUMBNAIL_VERSION ||
      edition.edition_id !== id || !sha.test(edition.checksum) ||
      p.view.status !== "published" || !sha.test(p.view.bundle_sha256 ?? "") ||
      !Array.isArray(p.view.maps) || p.view.maps.length > 40 || !Array.isArray(p.thumbnails) ||
      p.thumbnails.length !== p.view.maps.length ||
      new Set(p.view.maps.map(m => m.id)).size !== p.view.maps.length ||
      !p.thumbnails.every((t, i) => t.map_id === p.view.maps[i].id && sha.test(t.map_id) &&
        sha.test(t.sha256) && Number.isSafeInteger(t.bytes) && t.bytes > 0 && t.bytes <= journalThumbnailLimit) ||
      journalMapCards(p.view, id, edition.date, edition.map_selection).length !== p.view.maps.length)
    throw Error("JOURNAL_PUBLICATION_BINDING");
  return p;
}

const cache = new Map<string, Promise<JournalPublication | null>>();
export async function readJournalPublication(id: string, store?: MapObjectStore): Promise<JournalPublication | null> {
  if (store) {
    const raw = await store.read(journalIndexPath(id), journalIndexLimit);
    return raw ? decode(raw, id) : null;
  }
  if (process.env.AGRICLIMAX_JOURNAL_PROJECTION_ENABLED !== "true") return null;
  const backend = journalObjectStore();
  const existing = cache.get(id);
  if (existing) return existing;
  const pending = backend.read(journalIndexPath(id), journalIndexLimit).then(raw => raw ? decode(raw, id) : null);
  if (cache.size >= 48) cache.delete(cache.keys().next().value!);
  cache.set(id, pending);
  const forget = () => {if (cache.get(id) === pending) cache.delete(id);};
  void pending.then(value => {if (!value) forget();}, forget);
  return pending;
}

export function encodeJournalPublication(publication: JournalPublication) {
  const body = JSON.stringify(publication);
  const index = Buffer.from(JSON.stringify({body, sha256: journalObjectDigest(Buffer.from(body))}));
  if (index.length > journalIndexLimit) throw Error("JOURNAL_PUBLICATION_BUDGET");
  decode(index, publication.edition.edition_id);
  return index;
}

export async function readJournalThumbnail(p: JournalPublication, mapId: string, checksum: string, store = journalObjectStore()) {
  const ref = p.thumbnails.find(t => t.map_id === mapId && t.sha256 === checksum);
  if (!ref) return null;
  const raw = await store.read(journalImagePath(p.edition.edition_id, ref), journalThumbnailLimit);
  if (!raw || raw.byteLength !== ref.bytes || journalObjectDigest(raw) !== ref.sha256) throw Error("JOURNAL_THUMBNAIL_CHECKSUM");
  return raw;
}

export function publishedJournalCards(edition: ConsultableEdition, p: JournalPublication) {
  if (edition.edition_id !== p.edition.edition_id || edition.checksum !== p.edition.checksum ||
      edition.date !== p.edition.date) return null;
  return journalMapCards(p.view, edition.edition_id, edition.date, edition.map_selection).map((card, i) => ({
    ...card,
    thumbnail_url: `${card.thumbnail_url}&sha=${p.thumbnails[i].sha256}`,
  }));
}
