import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgriculturalDataset, AgriculturalManifest, WheatAgriculturalContext } from '../../features/agriculture/model';
import { ApiError } from './query';

const directory = path.join(process.cwd(), 'data/agriculture');
export async function agriculturalData(params: URLSearchParams) {
  if ([...params.keys()].some(k => !['action', 'indicator', 'pra'].includes(k) || params.getAll(k).length !== 1)) throw new ApiError('INVALID_QUERY', 400);
  if (params.get('action') === 'wheat-context' && !params.has('indicator')) {
    const pra = params.get('pra');
    if (!pra || !/^pra:[0-9AB]{5,8}$/.test(pra)) throw new ApiError('INVALID_QUERY', 400);
    const context = JSON.parse(await readFile(path.join(directory, 'rpg-wheat-context.json'), 'utf8')) as WheatAgriculturalContext;
    const distribution = await Promise.all(context.manifest.indicators.map(async i => {
      const dataset = JSON.parse(await readFile(path.join(directory, `${i.id}.json`), 'utf8')) as AgriculturalDataset;
      const row = dataset.rows.find(r => r.code === pra.slice(4));
      return { id: i.production, label: i.label, area_ha: row?.values[0] ?? null, status: row?.statuses[0] ?? 'unavailable' };
    }));
    return { year: context.year, source: context.manifest, data: context.pra[pra.slice(4)] ?? null, distribution,
      rule_version: context.manifest.rule_version, data_freshness: context.manifest.published_at,
      provenance: context.manifest.url, quality_flags: context.manifest.quality_flags ?? [] };
  }
  const sourceFiles = ['saa-manifest.json', 'rpg-manifest.json'];
  const attempts = await Promise.allSettled(sourceFiles.map(async name => JSON.parse(await readFile(path.join(directory, name), 'utf8')) as AgriculturalManifest));
  const sources = attempts.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (!sources.length) throw new ApiError('UPSTREAM_UNAVAILABLE', 503);
  if (params.get('action') === 'catalog' && !params.has('indicator') && !params.has('pra')) return { sources, indicators: sources.flatMap(s => s.indicators), source_errors: attempts.flatMap((result, i) => result.status === 'rejected' ? [sourceFiles[i]] : []) };
  if (params.get('action') !== 'dataset' || params.has('pra')) throw new ApiError('INVALID_QUERY', 400);
  const id = params.get('indicator');
  if (!id || !sources.some(s => s.indicators.some(i => i.id === id))) throw new ApiError('INVALID_QUERY', 400);
  // Only exact IDs in the reviewed manifest can select local files.
  const source = sources.find(s => s.indicators.some(i => i.id === id))!;
  return { ...JSON.parse(await readFile(path.join(directory, `${id}.json`), 'utf8')) as AgriculturalDataset,
    source, rule_version: source.rule_version, data_freshness: source.published_at,
    provenance: source.url, quality_flags: source.quality_flags ?? [] };
}
export async function readAgriculture(request: Request) {
  try {
    return Response.json(await agriculturalData(new URL(request.url).searchParams), { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError('UPSTREAM_UNAVAILABLE', 503);
    return Response.json({ error: safe.code }, { status: safe.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
