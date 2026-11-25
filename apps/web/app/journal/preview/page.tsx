import {manualCatalogue} from "../../../lib/server/manual-journal";
import {ManualMaps} from "../../../features/nightly/manual-maps";
import JournalPraMap from "../../../features/journal/ui/pra-map";
import { Suspense } from "react";
import { EditorialPreview } from "../../../features/editorial-ai/preview";
import {
  previewEdition,
  previewEditions,
} from "../../../lib/server/editorial-preview";
import "../journal.css";
export const dynamic = "force-dynamic";
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  const { date, id } = await searchParams;
  const catalogue=process.env.AGRICLIMAX_MANUAL_RUN_DIR?manualCatalogue():[];
  const edition=previewEdition(date,id);
  const map=edition?.illustrations.find(illustration=>edition.draft.illustration_ids.includes(illustration.id));
  return (
    <>
    <EditorialPreview
      edition={edition}
      mapCarousel={edition && map && <JournalPraMap
        key={map.id}
        run={map.cycle}
        phenomenon={map.phenomenon}
        period={map.period}
        source={map.data.source}
        archiveUrl={`/api/journal-preview/map?id=${edition.edition_id}&map=${map.id}`}
      />}
      editions={previewEditions()}
    />
    {catalogue.length>0&&<ManualMaps catalogue={catalogue}/>}
    </>
  );
}
export default function Page(props: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="journal">
          <p role="status">Lecture de l’archive…</p>
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
