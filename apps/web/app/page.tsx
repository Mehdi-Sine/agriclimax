import Link from 'next/link';
import { CattleWorkspace } from '../features/cattle/workspace';
import { loadShellData } from "../components/shell/load-shell-data";
import { parseContext } from "../lib/url-state";
import { ProductShell } from "../components/shell/product-shell";
import { redirect } from "next/navigation";
import { WheatWorkspace } from "../features/wheat/workspace";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value))
      for (const item of value) params.append(key, item);
  }
  if (params.get('mode') === 'wheat') return <WheatWorkspace params={params} view="observation" />;
  if (params.get('production') === 'cattle' && params.get('mode') === 'live_meteofrance') return <CattleWorkspace params={params} view="observation" />;
  const context = parseContext(params);
  if (params.get("view") === "watch") {
    params.delete("view");
    redirect(`/watch?${params}`);
  }
  const data = await loadShellData(params);
  const liveContext = Object.fromEntries(
    ["mode", "rule", "version", "bbox", "zoom", "limit"].flatMap((key) =>
      params.has(key) ? [[key, params.get(key)!]] : [],
    ),
  );
  return (
    <>
      <Link className="button button-secondary" href="/?mode=live_meteofrance&production=cattle&indicator=thi">Bovins · exposition thermique THI · live Météo-France</Link>
      <ProductShell context={context} data={data} liveContext={liveContext} />
    </>
  );
}
