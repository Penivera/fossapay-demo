import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeDeal // P2P Social Commerce Escrow',
  description: 'Zero-trust social commerce escrow powered by FossaPay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f19] text-slate-100 min-h-screen antialiased flex flex-col">
        <header className="border-b border-slate-800 bg-[#0d1322]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm">
                SD
              </span>
              <div>
                <a href="/" className="font-bold text-white text-base tracking-tight hover:text-emerald-400 transition">
                  SafeDeal
                </a>
                <span className="text-[10px] font-mono text-emerald-400 ml-2 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  FOSSAPAY ESCROW
                </span>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-xs font-mono">
              <a href="/" className="text-slate-300 hover:text-white transition">Create Deal</a>
              <a href="/admin" className="text-slate-400 hover:text-amber-400 transition flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Admin
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-800/60 py-6 text-center text-xs font-mono text-slate-500">
          SafeDeal • Powered by FossaPay Core Escrow & Payout APIs
        </footer>
      </body>
    </html>
  );
}
