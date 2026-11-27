/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/squadpay',
  // Shared design system ships as TypeScript source
  transpilePackages: ['@fossapay/ui'],
  async redirects() {
    return [
      {
        source: '/',
        destination: '/squadpay',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
