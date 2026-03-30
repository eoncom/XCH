/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* requests to the backend service
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://xch-backend:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  typescript: {
    // Allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['localhost'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Webpack configuration to handle Konva SSR issues
  webpack: (config, { isServer }) => {
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
