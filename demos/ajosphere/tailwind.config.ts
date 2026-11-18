import type { Config } from 'tailwindcss';
import preset from '@fossapay/ui/preset';

const config: Config = {
  presets: [preset as Partial<Config>],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  plugins: [],
};

export default config;
