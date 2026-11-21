import 'server-only';

// Checksum of the exact OFB/MASA reference snapshot used by the mask producer.
export const FORECAST_REFERENCE_SHA256 = '51bfc7b24222819a24dab1bdb5e6ffcdc483f8371e14a3c4ac9adddbc0f9d669';

const digest = /^[a-f0-9]{64}$/;

/**
 * Explicit bindings for retained or canary cycles. A configured table is
 * authoritative, including when it contains no entry for the requested archive.
 */
export function forecastIndexPin(archiveSha: string): string | undefined {
  if (process.env.COUV05_RENDER_ENABLED !== 'true') return;
  const bindings = process.env.COUV05_ARCHIVE_INDEX_PINS;
  if (bindings === undefined) {
    const legacy = process.env.COUV05_INDEX_SHA256;
    return legacy && digest.test(legacy) ? legacy : undefined;
  }
  const pins = new Map<string, string>();
  for (const binding of bindings.split(',')) {
    const [archive, pin, extra] = binding.trim().split('=');
    if (!digest.test(archive) || !digest.test(pin ?? '') || extra !== undefined || pins.has(archive)) return;
    pins.set(archive, pin);
    if (pins.size > 32) return;
  }
  return pins.get(archiveSha);
}

export type ForecastIndexLocation = { pin: string; prefix: string; certified?: true };

const bindingCache = new Map<string, { value: Promise<ForecastIndexLocation | undefined>; expires: number }>();

/** Resolve only the exact archive, after the producer commits its verified index. */
export function forecastIndexLocation(archiveSha: string): Promise<ForecastIndexLocation | undefined> {
  if (process.env.COUV05_RENDER_ENABLED !== 'true' || !digest.test(archiveSha)) return Promise.resolve(undefined);
  const explicit = process.env.COUV05_ARCHIVE_INDEX_PINS !== undefined ? forecastIndexPin(archiveSha) : undefined;
  if (explicit) return Promise.resolve({ pin: explicit, prefix: '' });
  if (process.env.COUV05_DAILY_INDEX_ENABLED !== 'true') {
    const legacy = forecastIndexPin(archiveSha);
    return Promise.resolve(legacy ? { pin: legacy, prefix: '' } : undefined);
  }
  const existing = bindingCache.get(archiveSha);
  if (existing && existing.expires > Date.now()) return existing.value;

  const value = (async () => {
    const { forecastBindingObject } = await import('./weather-archives');
    const { record } = await import('./weather-archive-codec');
    const raw = await forecastBindingObject(archiveSha);
    if (!raw) return undefined;
    const binding: unknown = JSON.parse(Buffer.from(raw).toString());
    if (!record(binding) || binding.version !== 'forecast-native-binding-1' ||
        binding.archive_sha256 !== archiveSha || typeof binding.index_sha256 !== 'string' ||
        !digest.test(binding.index_sha256) || !['cycle', 'shared'].includes(String(binding.layout))) {
      throw Error('FORECAST_MASK_ARCHIVE_BINDING');
    }
    return { pin: binding.index_sha256, certified: true as const,
      prefix: binding.layout === 'cycle' ? `forecast-native/v1/${archiveSha}/` : '' };
  })();
  bindingCache.delete(archiveSha);
  if (bindingCache.size >= 32) bindingCache.delete(bindingCache.keys().next().value!);
  const pending = { value, expires: Date.now() + 60_000 };
  bindingCache.set(archiveSha, pending);
  void value.then(location => {
    if (!location) pending.expires = Date.now() + 15_000;
  }, () => {
    if (bindingCache.get(archiveSha) === pending) bindingCache.delete(archiveSha);
  });
  return value;
}
