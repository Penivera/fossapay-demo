/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/safedeal',
  // Shared design system ships as TypeScript source
  transpilePackages: ['@fossapay/ui'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/safedeal',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
