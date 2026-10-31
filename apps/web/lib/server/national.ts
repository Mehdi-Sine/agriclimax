import 'server-only';
import { NATIONAL, DAYS } from '../../features/national/model';
import { territoryData, type TerritoryRow } from './territories';
import { ApiError } from './query';

export async function nationalData(
  params: URLSearchParams,
  transport: typeof fetch = fetch,
) {
  if (process.env.PRA_NATIONAL_ENABLED !== '1')
    throw new ApiError('NOT_CONFIGURED', 503);
  const action = params.get('action') || 'day',
    date = params.get('date') || '',
    pra = params.get('pra') || '';
  const allowed = action === 'day' ? ['action', 'date'] : ['action', 'pra'];
  if (
    !['day', 'history'].includes(action) ||
    [...params.keys()].some(
      (k) => !allowed.includes(k) || params.getAll(k).length !== 1,
    ) ||
    (action === 'day' && !DAYS.includes(date)) ||
    (action === 'history' && !/^pra:[0-9AB]{4,8}$/.test(pra))
  )
    throw new ApiError('INVALID_QUERY', 400);
  const base = {
    action: 'read',
    reference: NATIONAL.reference,
    dataset: NATIONAL.dataset,
  };
  const data: TerritoryRow[] = [];
  if (action === 'day') {
    let after = '';
    for (let page = 0; page < 8; page++) {
      const result = await territoryData(
        new URLSearchParams({
          ...base,
          date,
          scope: 'france',
          limit: '100',
          after,
        }),
        transport,
      );
      data.push(...result.data);
      after = result.next_cursor || '';
      if (!after) break;
    }
    if (
      after ||
      data.length !== 713 ||
      new Set(data.map((r) => r.id)).size !== 713
    )
      throw new ApiError('INVALID_RESPONSE', 502);
  } else {
    // Bound the selected-PRA history to 30 dates, four concurrent read-only requests.
    for (let i = 0; i < DAYS.length; i += 4) {
      const pages = await Promise.all(
        DAYS.slice(i, i + 4).map((day) =>
          territoryData(
            new URLSearchParams({
              ...base,
              date: day,
              scope: 'pra',
              id: pra,
              limit: '1',
            }),
            transport,
          ),
        ),
      );
      for (const [j, page] of pages.entries()) {
        if (
          page.data.length !== 1 ||
          page.data[0].id !== pra ||
          page.data[0].valid_date !== DAYS[i + j]
        )
          throw new ApiError('INVALID_RESPONSE', 502);
        data.push(page.data[0]);
      }
    }
  }
  return {
    reference_version: NATIONAL.reference,
    dataset_version: NATIONAL.dataset,
    source_id: 'era5-land',
    source_kind: 'reanalysis',
    method_version: 'pra-native-1',
    period: [NATIONAL.start, NATIONAL.end],
    data,
  };
}
export async function readNational(
  request: Request,
  transport: typeof fetch = fetch,
) {
  try {
    return Response.json(
      await nationalData(new URL(request.url).searchParams, transport),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const safe =
      error instanceof ApiError
        ? error
        : new ApiError('UPSTREAM_UNAVAILABLE', 502);
    return Response.json(
      { error: safe.code },
      { status: safe.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
