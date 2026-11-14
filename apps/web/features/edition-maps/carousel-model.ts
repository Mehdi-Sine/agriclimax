import type {EditionMapInfo, EditionMapsView} from "./model";
import type {SelectionView} from "../editorial-map-selection/model";
import {frenchPeriod} from "../journal/ui/editorial-dates";

export const THUMBNAIL_VERSION = "ux03-1";
/** Project checked selections onto the exact published catalogue. Historical
 * editions without an archived selection retain their published order. */
export type JournalMapCard = SelectionView["cards"][number] & {
  info: EditionMapInfo;
  thumbnail_url: string;
};
export function journalMapCards(view: EditionMapsView, editionId: string, date: string, selection?: {hero_map_id:string|null;map_ids:string[]}): JournalMapCard[] {
  const maps=selection?selection.map_ids.map(id=>view.maps.find(m=>m.id===id)).filter((m):m is EditionMapInfo=>!!m):view.maps;
  if(selection&&(maps.length!==selection.map_ids.length||new Set(selection.map_ids).size!==maps.length||maps.length>6||(maps[0]?.id??null)!==selection.hero_map_id))return [];
  return maps.map((info, order) => ({
    map_id: info.id, order, role: order === 0 ? "hero" : "complementary",
    title: info.title,
    caption: `${info.nature === "forecast" ? "Prévision" : "Historique · réanalyse"} · ${frenchPeriod(...info.period)}`,
    interactive_url: `/cartes-du-jour?${new URLSearchParams({date, id: editionId, map: info.id})}`,
    thumbnail_url: `/api/journal/thumbnail?${new URLSearchParams({id: editionId, map: info.id, v: THUMBNAIL_VERSION})}`,
    info,
  }));
}
