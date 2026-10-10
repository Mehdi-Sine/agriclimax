import type { AppContext } from './domain';

const keys = {
  productionId: 'production', indicatorId: 'indicator', date: 'date',
  territoryId: 'territory', compareDate: 'compare',
} as const;

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function parseContext(params: URLSearchParams): AppContext {
  const context: AppContext = {
    productionId: null, indicatorId: null, date: null, territoryId: null, compareDate: null,
  };
  for (const field of Object.keys(keys) as (keyof AppContext)[]) {
    const value = params.get(keys[field])?.trim();
    if (value && value.length <= 128 &&
        ((field === 'date' || field === 'compareDate') ? validDate(value) : /^[a-zA-Z0-9_-]+$/.test(value))) {
      context[field] = value;
    }
  }
  return context;
}

export function serializeContext(context: AppContext): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of Object.keys(keys) as (keyof AppContext)[]) {
    const value = context[field];
    if (value !== null) params.set(keys[field], value);
  }
  const normalized = parseContext(params);
  const canonical = new URLSearchParams();
  for (const field of Object.keys(keys) as (keyof AppContext)[]) {
    if (normalized[field] !== null) canonical.set(keys[field], normalized[field]);
  }
  return canonical;
}
