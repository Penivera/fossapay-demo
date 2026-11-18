/**
 * Tailwind preset for the FossaPay showcase. Colours resolve to CSS variables defined in theme.css
 * (space-separated RGB) so opacity modifiers like `bg-brand/10` work.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        subtle: v('subtle'),
        line: v('line'),
        'line-strong': v('line-strong'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        muted: v('muted'),
        brand: { DEFAULT: v('brand'), hover: v('brand-hover'), soft: v('brand-soft'), ink: v('brand-ink'), accent: v('brand-accent') },
        success: { DEFAULT: v('success'), soft: v('success-soft'), ink: v('success-ink') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft'), ink: v('warning-ink') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), ink: v('danger-ink') },
        info: { DEFAULT: v('info'), soft: v('info-soft'), ink: v('info-ink') },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        // Fluid type scale: scales smoothly between phone and wide desktop
        'display': ['clamp(2rem, 1.4rem + 2.2vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '650' }],
        'title': ['clamp(1.5rem, 1.2rem + 1vw, 2.125rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '650' }],
        'lead': ['clamp(1rem, 0.95rem + 0.25vw, 1.1875rem)', { lineHeight: '1.6' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 2px rgb(28 25 23 / 0.04), 0 8px 24px -12px rgb(28 25 23 / 0.10)',
        pop: '0 12px 40px -12px rgb(28 25 23 / 0.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'fade-in': 'fade-in 0.25s ease-out both',
        'pop-in': 'pop-in 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
};
