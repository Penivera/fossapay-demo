import type { Metadata } from 'next';
import './globals.css';
import { NearProvider } from '../providers/NearProvider';

export const metadata: Metadata = {
  title: 'NairaBridge // NEAR Intents to Nigerian Bank Accounts',
  description: 'Non-custodial cross-chain off-ramp powered by NEAR Intents and FossaPay',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <NearProvider>{children}</NearProvider>
      </body>
    </html>
  );
}
