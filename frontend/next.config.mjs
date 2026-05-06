/**
 * Static security headers applied to every response from the frontend.
 *
 * The Content-Security-Policy is NOT in this list — it is generated
 * per-request with a fresh nonce by `frontend/src/middleware.ts` (see
 * `frontend/src/lib/csp.ts`). Keeping the CSP out of next.config.mjs
 * guarantees a single source of truth and avoids the nonce header
 * being clobbered by the static value.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=(self)',
      'microphone=()',
      'geolocation=(self)',
      'accelerometer=()',
      'gyroscope=()',
      'magnetometer=()',
      'usb=()',
      'interest-cohort=()',
    ].join(', '),
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // credentialless: allow loading cross-origin resources without credentials
  // (keeps leaflet tile CDN usable without strict CORP on their side)
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
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
