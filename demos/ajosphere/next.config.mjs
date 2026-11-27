/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/ajosphere',
  // Shared design system ships as TypeScript source
  transpilePackages: ['@fossapay/ui'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/ajosphere',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
