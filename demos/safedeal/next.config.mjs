/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/safedeal',
  // Shared design system ships as TypeScript source
  transpilePackages: ['@fossapay/ui'],
};

export default nextConfig;
