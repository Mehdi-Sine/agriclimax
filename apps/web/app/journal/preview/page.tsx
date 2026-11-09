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
  return (
    <EditorialPreview
      edition={previewEdition(date, id)}
      editions={previewEditions()}
    />
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
