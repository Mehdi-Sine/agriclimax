import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Use the installed TypeScript compiler API: captured CLI output can be empty
    // in managed execution environments, preventing Next from parsing --showConfig.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
