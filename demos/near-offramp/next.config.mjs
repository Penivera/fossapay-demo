/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/near-offramp',
  // Shared design system ships as TypeScript source
  transpilePackages: ['@fossapay/ui'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/near-offramp',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
