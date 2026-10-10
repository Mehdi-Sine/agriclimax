import { loadShellData } from "../components/shell/load-shell-data";
import { parseContext } from "../lib/url-state";
import { ProductShell } from "../components/shell/product-shell";

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
  const context = parseContext(params);
  const data = await loadShellData(params);
  const liveContext = Object.fromEntries(
    ["mode", "rule", "version", "bbox", "zoom", "limit"].flatMap((key) =>
      params.has(key) ? [[key, params.get(key)!]] : [],
    ),
  );
  return (
    <ProductShell context={context} data={data} liveContext={liveContext} />
  );
}
