/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    `https://${process.env.REPLIT_DEV_DOMAIN}`,
    `http://${process.env.REPLIT_DEV_DOMAIN}`,
    process.env.REPLIT_DEV_DOMAIN,
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
};

export default nextConfig;
