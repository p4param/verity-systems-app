/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    `https://${process.env.REPLIT_DEV_DOMAIN}`,
    `http://${process.env.REPLIT_DEV_DOMAIN}`,
    process.env.REPLIT_DEV_DOMAIN,
    'http://127.0.0.1',
    'http://localhost',
  ].filter(Boolean),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  experimental: {
    turbopack: {
      root: '.',
    },
  },
};

export default nextConfig;
