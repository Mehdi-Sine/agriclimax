import type {EditionMapInfo, EditionMapsView} from "./model";
import type {SelectionView} from "../editorial-map-selection/model";
import {frenchPeriod} from "../journal/ui/editorial-dates";

export const THUMBNAIL_VERSION = "ux03-1";
/** EDIT-03 presentation contract, projected from the published catalogue only.
 * The simulation's hero, ranking and six-card shortlist are never activated. */
export type JournalMapCard = SelectionView["cards"][number] & {
  info: EditionMapInfo;
  thumbnail_url: string;
};
export function journalMapCards(view: EditionMapsView, editionId: string, date: string): JournalMapCard[] {
  return view.maps.map((info, order) => ({
    map_id: info.id, order, role: order === 0 ? "hero" : "complementary",
    title: info.title,
    caption: `${info.nature === "forecast" ? "Prévision" : "Historique · réanalyse"} · ${frenchPeriod(...info.period)}`,
    interactive_url: `/cartes-du-jour?${new URLSearchParams({date, id: editionId, map: info.id})}`,
    thumbnail_url: `/api/journal/thumbnail?${new URLSearchParams({id: editionId, map: info.id, v: THUMBNAIL_VERSION})}`,
    info,
  }));
}
