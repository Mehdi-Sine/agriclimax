import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import type {Archive} from "../apps/web/features/editorial-ai/model";
import {THUMBNAIL_VERSION} from "../apps/web/features/edition-maps/carousel-model";
import {mapInfo, type EditionMapBundle} from "../apps/web/features/edition-maps/model";
import {selectedMapIds} from "../apps/web/features/editorial-map-selection/daily";
import {insertExact, type MapObjectStore} from "../apps/web/lib/server/immutable-map-storage";
import {journalObjectStore} from "../apps/web/lib/server/journal-object-storage";
import {encodeJournalPublication, journalImagePath, journalIndexLimit, journalIndexPath,
  journalObjectDigest, journalThumbnailLimit, readJournalPublication, readJournalThumbnail,
  type JournalPublication} from "../apps/web/lib/server/journal-publication";
import {mapThumbnail} from "../apps/web/lib/server/map-thumbnail";

/** Call only after the ordinary map publication has committed and verified its bundle. */
export async function publishJournal(
  archive: Archive, bundle: EditionMapBundle, store: MapObjectStore = journalObjectStore(),
  execute = true,
) {
  if (archive.validation.status === "rejected") throw Error("JOURNAL_ARCHIVE_REJECTED");
  const edition = consultableEdition(archive), id = edition.edition_id;
  if (bundle.edition_id !== id || bundle.edition_checksum !== edition.checksum || bundle.edition_date !== edition.date)
    throw Error("JOURNAL_MAP_BINDING");
  const selection = archive.map_selection ? selectedMapIds(archive.map_selection, bundle) : bundle.maps.map(m => m.id);
  const existing = await readJournalPublication(id, store);
  if (existing) {
    if (existing.edition.checksum !== edition.checksum || existing.view.bundle_sha256 !== bundle.sha256)
      throw Error("JOURNAL_PUBLICATION_CONFLICT");
    if (execute) {
      for (const ref of existing.thumbnails) await readJournalThumbnail(existing, ref.map_id, ref.sha256, store);
    }
    return {status: "already_published", thumbnails: existing.thumbnails.length};
  }
  const images = [];
  const infos = [];
  for (const mapId of selection) {
    const map = bundle.maps.find(m => m.id === mapId);
    if (!map) throw Error("JOURNAL_MAP_BINDING");
    const {bytes} = await mapThumbnail(map, {
      exhaustive: map.rendering?.version === "couv06-history-1",
      coveredSupport: map.rendering?.covered_support,
    });
    if (bytes.length > journalThumbnailLimit) throw Error("JOURNAL_THUMBNAIL_BUDGET");
    infos.push(mapInfo(map));
    images.push({bytes, reference: {map_id: map.id, sha256: journalObjectDigest(bytes), bytes: bytes.length}});
  }
  const publication: JournalPublication = {
    version: "journal-publication-1", renderer: THUMBNAIL_VERSION, edition,
    view: {status: "published", code: "MAP_PUBLISHED", bundle_sha256: bundle.sha256, maps: infos},
    thumbnails: images.map(i => i.reference),
  };
  const index = encodeJournalPublication(publication);
  if (execute) {
    for (const image of images) await insertExact(store, journalImagePath(id, image.reference), image.bytes, journalThumbnailLimit);
    await insertExact(store, journalIndexPath(id), index, journalIndexLimit);
  }
  return {status: execute ? "published" : "simulation", index_bytes: index.length,
    thumbnail_bytes: images.reduce((size, image) => size + image.bytes.length, 0), thumbnails: images.length};
}
