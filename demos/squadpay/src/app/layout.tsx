import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SquadPay // Group Bill Splitter & Auto-Settlement',
  description: 'Split bills with friends and settle directly into host bank via FossaPay',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090e17] text-slate-100 min-h-screen antialiased flex flex-col">
        <header className="border-b border-slate-800 bg-[#0d1424]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 font-mono font-bold text-sm">
                SQ
              </span>
              <div>
                <a href="/" className="font-bold text-white text-base tracking-tight hover:text-violet-400 transition">
                  SquadPay
                </a>
                <span className="text-[10px] font-mono text-violet-400 ml-2 border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                  AUTO-SETTLEMENT RAILS
                </span>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-xs font-mono">
              <a href="/" className="text-slate-300 hover:text-white transition">New Split</a>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-slate-800/60 py-6 text-center text-xs font-mono text-slate-500">
          SquadPay • Automated Group Expense Settlement powered by FossaPay
        </footer>
      </body>
    </html>
  );
}
