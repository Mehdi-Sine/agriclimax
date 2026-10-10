import { DemoRiskRepository } from '../lib/demo-repository';
import { parseContext } from '../lib/url-state';

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const result = await new DemoRiskRepository().getMapFeatures(parseContext(params));
  return <main>
    <h1>AgriclimaX</h1><p>Observer. Comprendre. Anticiper.</p>
    <p data-demo="true"><strong>{result.label}</strong> — démonstration sans connexion externe.</p>
    <p>{result.data.features.length} territoire(s) fictif(s) disponible(s) pour ce contexte.</p>
  </main>;
}
