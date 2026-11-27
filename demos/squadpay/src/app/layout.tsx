import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@fossapay/ui';

export const metadata: Metadata = {
  title: 'SquadPay | Split bills with friends',
  description: 'Split group bills and settle straight into one bank account, powered by FossaPay',
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppShell name="SquadPay" mark="SQ" mode={mode} homeHref="/squadpay" nav={[{ href: '/squadpay', label: 'New split' }]}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
