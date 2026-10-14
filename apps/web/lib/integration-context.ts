import { parseContext, serializeContext } from './url-state';

/** Only shared navigation state crosses spaces; page-local filters stay local. */
export function sharedContext(params: URLSearchParams): URLSearchParams {
  const next = serializeContext(parseContext(params));
  for (const key of ['mode', 'rule', 'version', 'bbox', 'zoom', 'limit']) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

/** A diagnostic cell is the selected observation territory, including direct links. */
export function observationHref(params: URLSearchParams): string {
  const next = sharedContext(params);
  const cell = params.get('cell');
  if (cell && /^[A-Za-z0-9_.-]{1,100}$/.test(cell)) next.set('territory', cell);
  return `/?${next}`;
}
