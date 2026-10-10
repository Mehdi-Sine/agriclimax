/** Allowlisted structured operational logs. Never pass raw request/error objects. */
export const ERROR_CODES = Object.freeze({
  CONFIG_INVALID: 'CONFIG_INVALID',
  DATA_UNAVAILABLE: 'DATA_UNAVAILABLE',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});
const levels = new Set(['info', 'warn', 'error']);
const id = /^[a-zA-Z0-9_.:-]{1,80}$/;
export function createLogger(write = (line) => process.stdout.write(`${line}\n`)) {
  return (input) => {
    if (!levels.has(input.level) || !id.test(input.event ?? '') || !id.test(input.run_id ?? '')) {
      throw new TypeError('Invalid log level/event/run_id');
    }
    const entry = {
      timestamp: new Date().toISOString(), level: input.level,
      event: input.event, run_id: input.run_id,
    };
    if (input.error_code !== undefined) {
      if (!Object.hasOwn(ERROR_CODES, input.error_code)) throw new TypeError('Unknown error code');
      entry.error_code = input.error_code;
    }
    if (input.duration_ms !== undefined) {
      if (!Number.isFinite(input.duration_ms) || input.duration_ms < 0) throw new TypeError('Invalid duration');
      entry.duration_ms = input.duration_ms;
    }
    if (typeof input.demo === 'boolean') entry.demo = input.demo;
    write(JSON.stringify(entry));
  };
}
