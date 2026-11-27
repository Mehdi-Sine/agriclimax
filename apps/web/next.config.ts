import type { NextConfig } from 'next';

// The protected PR preview is the PREV-02 canary. Production uses project flags.
const forecastCanary = process.env.VERCEL_ENV === 'preview' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'codex/PREV-02-native-publication';

const nextConfig: NextConfig = {
  ...(forecastCanary ? { env: {
    COUV05_RENDER_ENABLED: 'true',
    COUV05_DAILY_INDEX_ENABLED: 'true',
    NEXT_PUBLIC_COUV04_RENDER_ENABLED: 'true',
    NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED: 'true',
  } } : {}),
  async redirects() {
    return [
      { source: '/', has: [{ type: 'query' as const, key: 'view', value: 'watch' }], destination: '/watch', permanent: false },
      ...['demo', 'live', 'live_meteofrance', 'wheat'].map(mode => ({
        source: '/', has: [{ type: 'query' as const, key: 'mode', value: mode }],
        destination: mode === 'demo' ? '/demo' : '/stations', permanent: false,
      })),
    ];
  },
  async headers() {
    return ['/maps/pra-national.geojson', '/maps/journal-pra-v1.geojson'].map(source => ({
      source, headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
    }));
  },
  // Served directly as a public asset. These functions only use the separate
  // Journal outline, or receive the detailed geometry from the browser.
  outputFileTracingExcludes: {
    "/": ["./public/maps/pra-national.geojson"],
    "/journal": ["./public/maps/pra-national.geojson"],
    "/api/journal/thumbnail": ["./public/maps/pra-national.geojson"],
    "/cartes-du-jour": ["./public/maps/pra-national.geojson"],
  },
  outputFileTracingIncludes: {
    "/api/journal/thumbnail": ["./public/maps/journal-pra-v1.geojson", "./styles/tokens.css"],
  },
  experimental: {
    // Use the installed TypeScript compiler API: captured CLI output can be empty
    // in managed execution environments, preventing Next from parsing --showConfig.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
