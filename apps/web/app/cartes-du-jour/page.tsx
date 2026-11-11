import Link from "next/link";
import {EditorialHeader} from "../../components/navigation/editorial-header";
import {DailyMapsCarousel,type ArchivedMap} from "../../components/navigation/daily-maps-carousel";
import {operationalEditions} from "../../lib/server/editorial-published";
import {editionMaps} from "../../lib/server/edition-maps";
import {EditionMaps} from "../../features/edition-maps/view";
import "../../app/journal/journal.css";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{date?:string;id?:string;map?:string}>}){
  const p=await searchParams;
  let editions:Awaited<ReturnType<typeof operationalEditions>>=[];
  try{editions=await operationalEditions();}catch{/* Empty state; never synthesize maps. */}
  const edition=(p.date||p.id?editions.find(e=>(!p.date||e.date===p.date)&&(!p.id||e.edition_id===p.id)):editions[0]);
  const slides:ArchivedMap[]=edition?.illustrations.filter(m=>edition.draft.illustration_ids.includes(m.id)).slice(0,10).map(m=>({id:m.id,caption:m.caption,phenomenon:m.phenomenon,period:m.period,cycle:m.cycle,source:m.data.source}))??[];
  const maps=edition?(await editionMaps(edition)).view:undefined;
  return <><EditorialHeader active="cartes"/><main className="ux01-daily">
  <p className="ux01-kicker">LES CARTES DU JOUR · FRANCE MÉTROPOLITAINE ET CORSE</p>
  <h1>Le climat en cartes</h1><p className="ux01-deck">Une sélection de cartes réellement archivées, à la maille des 713 petites régions agricoles. Seuls les indicateurs et périodes disponibles sont présentés.</p>
  <p>{edition?<>Édition du {new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(edition.date+"T12:00:00Z"))} · <Link href={`/journal?date=${edition.date}&id=${edition.edition_id}`}>Consulter l’édition complète</Link></>:"Aucune édition archivée consultable pour cette date."}</p>
  {edition&&slides.length>0&&<p className="ux01-map-caption">Les cartes présentées proviennent des archives de cette édition ; aucune carte récente ne remplace une carte historique.</p>}
  {maps&&(maps.maps.length>0||!slides.length)?<EditionMaps key={`${edition?.edition_id}:${p.map??""}`} view={maps} editionId={edition!.edition_id} initialMapId={p.map}/>:<DailyMapsCarousel key={`${edition?.edition_id??"empty"}:${p.map??""}`} slides={slides} editionId={edition?.edition_id??""} initialMapId={p.map}/>}
  <details><summary>Sources et réserves</summary><p>Chaque carte conserve sa période, son cycle et sa source d’origine. Les couleurs traduisent des grandeurs météorologiques et non des dommages agricoles. La sélection éditoriale IA automatisée et la génération d’images préchargées seront intégrées séparément dans JOUR-02.</p><Link href="/aide-et-documentation">Aide et documentation</Link></details>
  </main></>;
}
