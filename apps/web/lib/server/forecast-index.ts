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
