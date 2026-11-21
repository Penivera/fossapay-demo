import type { Metadata } from 'next';
import './globals.css';
import { AppShell, ModeProvider } from '@fossapay/ui';
import { NearProvider } from '../providers/NearProvider';
import { WalletButton } from '../components/WalletButton';

export const metadata: Metadata = {
  title: 'NairaBridge | Crypto to Nigerian bank accounts',
  description: 'Cross-chain off-ramp powered by NEAR Intents and FossaPay',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

// Mode is read per request so one build can run in either mode
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mode = process.env.FOSSAPAY_MODE === 'live' ? 'live' : 'mock';
  return (
    <html lang="en">
      <body>
        <ModeProvider mode={mode}>
          <NearProvider>
            <AppShell name="NairaBridge" mark="NB" mode={mode} homeHref="/near-offramp" actions={<WalletButton />}>
              {children}
            </AppShell>
          </NearProvider>
        </ModeProvider>
      </body>
    </html>
  );
}
