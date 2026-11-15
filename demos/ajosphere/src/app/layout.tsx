import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AjoSphere | Digital Rotating Savings & Credit Club',
  description: 'Automated Nigerian Esusu/Ajo powered by FossaPay Dedicated Accounts, KYC, and Payout APIs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
