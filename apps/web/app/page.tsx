import { LiveWorkspace } from '../features/live/workspace';
import { isLiveWorkspace } from '../features/live/context';
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
  if (params.get("view") === "watch") {
    params.delete("view");
    redirect(`/watch?${params}`);
  }
  if (isLiveWorkspace(params)) return await LiveWorkspace({params, view:'observation'});
  if (params.get('mode') === 'wheat') return <WheatWorkspace params={params} view="observation" />;
  const context = parseContext(params);
  const data = await loadShellData(params);
  const liveContext = Object.fromEntries(
    ["mode", "rule", "version", "bbox", "zoom", "limit"].flatMap((key) =>
      params.has(key) ? [[key, params.get(key)!]] : [],
    ),
  );
  const liveIndicatorsHref = '/?mode=live_meteofrance&production=wheat&indicator=gdd';
  const liveCattleHref = '/?mode=live_meteofrance&production=cattle&indicator=thi';
  return (
    <>
      <a className="button button-secondary" href={liveIndicatorsHref}>Carte live · blé et bovins</a>
      <a className="button button-secondary" href={liveCattleHref}>Bovins · exposition thermique THI · live Météo-France</a>
      <ProductShell context={context} data={data} liveContext={liveContext} />
    </>
  );
}
