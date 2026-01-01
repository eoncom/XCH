import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // Disable static optimization for dynamic routes
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
