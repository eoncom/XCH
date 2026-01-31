import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // ⚠️ Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost'],
  },
  // Disable static optimization for dynamic routes
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Webpack configuration to handle Konva SSR issues
  webpack: (config, { isServer }) => {
    // Externalize canvas module for both server and client
    // Konva requires canvas for Node.js but it's not needed in browser
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('canvas');
    } else if (typeof config.externals === 'object') {
      config.externals['canvas'] = 'canvas';
    }
    return config;
  },
};

export default nextConfig;
