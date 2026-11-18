import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@fossapay/ui';

export const metadata: Metadata = {
  title: 'AjoSphere | Digital savings circles',
  description: 'Automated Ajo/Esusu savings clubs with verified members and dedicated accounts, powered by FossaPay',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mode = process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock';
  return (
    <html lang="en">
      <body>
        <AppShell name="AjoSphere" mark="AS" mode={mode} nav={[{ href: '/', label: 'Clubs' }]}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
