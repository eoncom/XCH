/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
