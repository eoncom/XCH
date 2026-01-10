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
  // Webpack configuration to handle Konva SSR issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize canvas module for server-side rendering
      // Konva requires canvas for SSR but it's not needed in our use case
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas');
      }
    }
    return config;
  },
};

export default nextConfig;
