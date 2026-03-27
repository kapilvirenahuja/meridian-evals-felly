import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@felly/shared-types'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
