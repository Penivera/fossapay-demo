import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@fossapay/ui';

export const metadata: Metadata = {
  title: 'SafeDeal | Escrow for social commerce',
  description: 'Escrow payments for WhatsApp and Instagram sellers, powered by FossaPay',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock';
  return (
    <html lang="en">
      <body>
        <AppShell
          name="SafeDeal"
          mark="SD"
          mode={mode}
          homeHref="/safedeal"
          nav={[
            { href: '/safedeal', label: 'Create deal' },
            { href: '/safedeal/admin', label: 'Mediation' },
          ]}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
