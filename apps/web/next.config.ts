import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    return [{ source: '/maps/pra-national.geojson', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] }];
  },
  experimental: {
    // Use the installed TypeScript compiler API: captured CLI output can be empty
    // in managed execution environments, preventing Next from parsing --showConfig.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
