// Pure web implementation of the Python reference, verified with shared golden cases.
import defaultRule from '../../../../config/cattle/thi-v1.json';
export type ThiRule = Omit<typeof defaultRule, 'scientific_status' | 'parameter_status'> & {
  scientific_status: 'exploratory' | 'reviewed' | 'validated';
  parameter_status: 'exploratory' | 'reviewed' | 'validated';
};
export const cattleRule = defaultRule as ThiRule;
export interface Sample { at: string; temperature_c: number | null; humidity_pct: number | null }
export function thi(t: number, rh: number, formulaId = cattleRule.formula_id) {
  if (formulaId !== 'bohmanova-2005-thi-26-v1') throw new Error('Unknown THI variant');
  if (!Number.isFinite(t) || t < -273.15 || !Number.isFinite(rh) || rh < 0 || rh > 100) throw new Error('Invalid THI input');
  return (1.8*t+32)-(0.55-0.0055*rh)*(1.8*t-26);
}
function validateRule(rule: ThiRule) {
  if (!['exploratory', 'reviewed', 'validated'].includes(rule.scientific_status)
    || !['exploratory', 'reviewed', 'validated'].includes(rule.parameter_status)
    || rule.production !== 'cattle' || !rule.rule_version || !rule.source.url
    || rule.formula !== cattleRule.formula || rule.formula_id !== cattleRule.formula_id
    || !rule.thresholds.length || rule.thresholds.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= rule.thresholds[i-1]))
    || !Number.isFinite(rule.recovery_threshold)
    || rule.classes.some((c, i) => !Number.isFinite(c.minimum) || (i > 0 && c.minimum <= rule.classes[i-1].minimum))
    || !Number.isInteger(rule.night_start_hour) || !Number.isInteger(rule.night_end_hour)
    || rule.night_start_hour > 23 || rule.night_end_hour < 0 || rule.night_start_hour <= rule.night_end_hour) throw new Error('Invalid THI rule');
}
export function evaluateThi(samples: Sample[], options: {
  start: string; end: string; resolution: 'hourly' | 'daily';
  freshness: 'fresh' | 'stale' | 'unknown'; provenance: unknown[]; rule?: ThiRule;
}) {
  const rule = options.rule ?? cattleRule;
  validateRule(rule);
  const aware = (at: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(at);
  if (!aware(options.start) || !aware(options.end)) throw new Error('Timezone required');
  const start = Date.parse(options.start), end = Date.parse(options.end);
  const step = options.resolution === 'hourly' ? 3600000 : 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start % step || (end-start) % step || (end-start)/step > (options.resolution === 'hourly' ? 8784 : 366)) throw new Error('Invalid period');
  const values = new Map<number, number | null>();
  let missingHumidity = false;
  for (const row of samples) {
    if (!aware(row.at) || (row.temperature_c !== null && (!Number.isFinite(row.temperature_c) || row.temperature_c < -273.15))
      || (row.humidity_pct !== null && (!Number.isFinite(row.humidity_pct) || row.humidity_pct < 0 || row.humidity_pct > 100))) throw new Error('Invalid sample');
    const at = Date.parse(row.at);
    if (!Number.isFinite(at) || values.has(at) || at < start || at >= end || (at-start) % step) throw new Error('Duplicate, outside or unaligned sample');
    missingHumidity ||= row.humidity_pct === null;
    values.set(at, row.temperature_c === null || row.humidity_pct === null ? null : thi(row.temperature_c, row.humidity_pct, rule.formula_id));
  }
  const series = Array.from({length: (end-start)/step}, (_, i) => ({at: new Date(start+i*step).toISOString(), value: values.get(start+i*step) ?? null}));
  const good = series.flatMap(row => row.value === null ? [] : [row.value]);
  const coverage = good.length/series.length;
  const dates = [...new Set(series.map(row => row.at.slice(0, 10)))];
  const daily = dates.map(date => {
    const rows = series.filter(row => row.at.startsWith(date));
    const usable = rows.flatMap(row => row.value === null ? [] : [row.value]);
    const n = options.resolution === 'hourly' ? 24 : 1;
    const complete = usable.length === n;
    return {date, coverage: usable.length/n,
      thi_mean: complete && n === 24 ? usable.reduce((a,b) => a+b,0)/24 : null,
      thi_max: complete && n === 24 ? Math.max(...usable) : null,
      thi_synthetic: complete && n === 1 ? usable[0] : null};
  });
  const metrics = rule.thresholds.map(threshold => {
    let count = 0, episodes = 0, longest = 0, run = 0, cumulative = 0;
    for (const row of series) {
      if (row.value !== null && row.value > threshold) {
        count++; if (run === 0) episodes++; run++; longest = Math.max(longest, run); cumulative += row.value-threshold;
      } else run = 0;
    }
    return {threshold, comparison: '>', count: good.length ? count : null,
      unit: options.resolution === 'hourly' ? 'h' : 'd',
      days_above: good.length ? dates.filter(date => series.some(row => row.at.startsWith(date) && row.value !== null && row.value > threshold)).length : null,
      episodes: good.length ? episodes : null, max_episode_duration: good.length ? longest : null,
      cumulative_exposure: good.length ? cumulative : null,
      exposure_unit: options.resolution === 'hourly' ? 'THI.h' : 'THI.d', partial: coverage < 1, episode_count_kind: coverage < 1 ? 'observed_fragments' : 'complete_period_episodes'};
  });
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone: rule.night_timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'});
  function nightKey(at: number) {
    const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
    const hour = Number(parts.hour), date = `${parts.year}-${parts.month}-${parts.day}`;
    if (hour >= rule.night_start_hour) return date;
    if (hour < rule.night_end_hour) return new Date(Date.parse(date)-86400000).toISOString().slice(0,10);
    return null;
  }
  const nights = new Map<string, (number | null)[]>();
  if (options.resolution === 'hourly') for (const row of series) {
    const key = nightKey(Date.parse(row.at));
    if (key) nights.set(key, [...(nights.get(key) ?? []), row.value]);
  }
  let completeNights = 0, noRecovery = 0;
  for (const [key, rows] of nights) {
    // Enumerate actual UTC hours: handles 7/9-hour nights at DST changes.
    let expected = 0;
    for (let at = Date.parse(key)-86400000; at < Date.parse(key)+3*86400000; at += 3600000) if (nightKey(at) === key) expected++;
    if (rows.length === expected && rows.every(v => v !== null)) {
      completeNights++; if (rows.every(v => v !== null && v >= rule.recovery_threshold)) noRecovery++;
    }
  }
  const value = good.length ? Math.max(...good) : null;
  let level: string | null = value === null ? null : 'below_configured_reference';
  if (value !== null) for (const boundary of rule.classes) if (value >= boundary.minimum) level = boundary.level;
  return {rule_id: rule.rule_id, rule_version: rule.rule_version, production: 'cattle',
    formula_id: rule.formula_id, formula: rule.formula, value, unit: 'THI',
    value_kind: options.resolution === 'hourly' ? 'maximum_observed_sample' : 'maximum_daily_synthetic',
    status: !good.length ? 'unavailable' : coverage === 1 ? 'available' : 'insufficient',
    reason: good.length ? null : missingHumidity ? 'humidity_missing' : 'temperature_humidity_pairs_missing',
    period: {start: new Date(start).toISOString(), end_exclusive: new Date(end).toISOString(), timezone: 'UTC'},
    resolution: options.resolution, level, thresholds: rule.thresholds,
    confidence: {level: 'low', coverage, reason: 'no_validated_confidence_policy'},
    freshness: options.freshness, data_freshness: options.freshness, provenance: options.provenance,
    scientific_source: rule.source, scientific_status: rule.scientific_status, limits: rule.limits, notice: rule.notice,
    quality_flags: [...(coverage < 1 ? ['incomplete_coverage', 'counts_durations_lower_bounds_episodes_observed_fragments'] : []),
      ...(options.resolution === 'daily' ? ['synthetic_daily_not_hourly_mean', 'source_daily_windows_not_harmonized'] : [])],
    series, daily, metrics,
    night_recovery: {status: completeNights ? 'available' : 'unavailable',
      reason: options.resolution === 'daily' ? 'hourly_data_required' : completeNights ? null : 'complete_night_required',
      nights_without_recovery: completeNights ? noRecovery : null, complete_nights: completeNights,
      incomplete_nights: nights.size-completeNights, threshold: rule.recovery_threshold,
      timezone: rule.night_timezone, start_hour: rule.night_start_hour, end_hour: rule.night_end_hour},
    anomaly: {status: 'unavailable', value: null, reason: 'Task12_reference_has_no_humidity_or_homologous_THI'}};
}
export type ThiResult = ReturnType<typeof evaluateThi>;
