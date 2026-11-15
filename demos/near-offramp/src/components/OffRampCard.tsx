'use client';

import React, { useState, useEffect } from 'react';
import { useNear } from '../providers/NearProvider';
import { ArrowDown, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, Building2, Zap, Shield, Sparkles } from 'lucide-react';
import { BankSearchModal } from './BankSearchModal';
import { TokenSelectModal, ALL_SUPPORTED_ASSETS, type Asset } from './TokenSelectModal';
import { ReviewDrawer } from './ReviewDrawer';

interface Bank {
  name: string;
  code: string;
}

interface OffRampCardProps {
  onOpenWalletModal: () => void;
  onInitiate: (details: {
    originAsset: Asset;
    amountIn: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountName: string;
    netNgn: number;
    quoteId: string;
    depositAddress: string;
  }) => void;
}

export const OffRampCard: React.FC<OffRampCardProps> = ({ onOpenWalletModal, onInitiate }) => {
  const { isConnected } = useNear();

  // Inputs
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ALL_SUPPORTED_ASSETS[0]);
  const [amountIn, setAmountIn] = useState<string>('50.00');
  const [accountNumber, setAccountNumber] = useState<string>('0123456789');
  const [selectedBankCode, setSelectedBankCode] = useState<string>('100004');

  // Modals
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Directory & Resolution
  const [banks, setBanks] = useState<Bank[]>([]);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>('OLUWASEUN CHUKWUDI ADENIYI');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Quote State
  const [quote, setQuote] = useState<{
    quoteId: string;
    depositAddress: string;
    netNgn: number;
    exchangeRateNgn: number;
    fiatPayoutFeeNgn: number;
  } | null>({
    quoteId: 'quote_initial',
    depositAddress: '0x3a9f1b4c798e8c2',
    netNgn: 79700.00,
    exchangeRateNgn: 1595.00,
    fiatPayoutFeeNgn: 50.00,
  });
  const [isQuoting, setIsQuoting] = useState<boolean>(false);

  // Rate Lock Countdown
  const [countdown, setCountdown] = useState<number>(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Banks
  useEffect(() => {
    async function loadBanks() {
      try {
        const res = await fetch('/api/banks');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
          setBanks(data.data);
          if (data.data.length > 0 && !selectedBankCode) {
            setSelectedBankCode(data.data[0].code);
          }
        }
      } catch (err) {
        console.error('Failed to load banks:', err);
      }
    }
    loadBanks();
  }, []);

  // Live Bank Resolution when 10 digits entered
  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBankCode) {
      setResolvedAccountName(null);
      setResolveError(null);
      return;
    }

    let isMounted = true;
    setIsResolving(true);
    setResolveError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/banks/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountNumber, bankCode: selectedBankCode }),
        });
        const json = await res.json();

        if (isMounted) {
          if (json.status === 'success' && json.data?.accountName) {
            setResolvedAccountName(json.data.accountName);
            setResolveError(null);
          } else {
            setResolvedAccountName(null);
            setResolveError(json.message || 'Unable to resolve bank account');
          }
        }
      } catch {
        if (isMounted) {
          setResolvedAccountName(null);
          setResolveError('Bank enquiry request failed');
        }
      } finally {
        if (isMounted) setIsResolving(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [accountNumber, selectedBankCode]);

  // Live Quote Calculation
  useEffect(() => {
    const parsedAmount = parseFloat(amountIn);
    if (!parsedAmount || parsedAmount <= 0) {
      setQuote(null);
      return;
    }

    let isMounted = true;
    setIsQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originAsset: selectedAsset,
            amountIn,
          }),
        });
        const json = await res.json();

        if (isMounted && json.status === 'success') {
          setQuote(json.data);
        }
      } catch (err) {
        console.error('Quote fetch failed:', err);
      } finally {
        if (isMounted) setIsQuoting(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [amountIn, selectedAsset]);

  const currentBank = banks.find((b) => b.code === selectedBankCode) || {
    name: 'OPay Digital Services',
    code: '100004',
  };

  const handleQuickPercent = (pct: number) => {
    const base = 240.50; // Mock wallet balance
    const calc = ((base * pct) / 100).toFixed(2);
    setAmountIn(calc);
  };

  const handleReviewConfirm = () => {
    if (!quote || !resolvedAccountName) return;
    setIsReviewOpen(false);
    onInitiate({
      originAsset: selectedAsset,
      amountIn,
      accountNumber,
      bankCode: selectedBankCode,
      bankName: currentBank.name,
      accountName: resolvedAccountName,
      netNgn: quote.netNgn,
      quoteId: quote.quoteId,
      depositAddress: quote.depositAddress,
    });
  };

  const canSubmit = isConnected && Boolean(resolvedAccountName) && Boolean(quote) && !isResolving;

  return (
    <>
      <div className="w-full cf-card-dark p-6 sm:p-8 space-y-6">
        {/* 01 // ORIGIN ASSET (CRYPTO) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-orange-500/10 text-orange-400 flex items-center justify-center font-mono text-[10px] font-bold border border-orange-500/20">
                01
              </span>
              <span className="cf-kicker">ORIGIN ASSET (YOU SELL)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-slate-400">
                Balance: 240.50
              </span>
              <button
                onClick={() => handleQuickPercent(25)}
                className="px-1.5 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 font-mono text-[10px] text-slate-300 border border-white/[0.06] transition"
              >
                25%
              </button>
              <button
                onClick={() => handleQuickPercent(50)}
                className="px-1.5 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 font-mono text-[10px] text-slate-300 border border-white/[0.06] transition"
              >
                50%
              </button>
              <button
                onClick={() => handleQuickPercent(100)}
                className="px-1.5 py-0.5 rounded-md bg-orange-500/15 hover:bg-orange-500/25 font-mono text-[10px] text-orange-400 border border-orange-500/30 transition font-semibold"
              >
                MAX
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Input with softly indented background */}
            <div className="flex-1 relative bg-slate-950/60 border border-white/[0.08] focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/15 rounded-xl px-4 py-3 transition-all duration-200">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">
                Spend Amount
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="w-full bg-transparent font-mono text-2xl sm:text-3xl font-bold text-white outline-none tracking-tight"
              />
              <div className="absolute right-4 bottom-3 text-xs font-mono text-slate-400">
                ≈ ${(parseFloat(amountIn) || 0).toFixed(2)} USD
              </div>
            </div>

            {/* Token Selector Pill */}
            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="sm:w-56 bg-slate-950/60 border border-white/[0.08] hover:border-orange-500/40 rounded-xl px-4 py-3 font-mono text-xs font-semibold text-slate-100 flex items-center justify-between transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 text-xs font-bold shrink-0">
                  {selectedAsset.symbol.slice(0, 3)}
                </span>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">{selectedAsset.symbol}</div>
                  <div className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">
                    {selectedAsset.chain}
                  </div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </button>
          </div>
        </div>

        {/* Solver Rate Indicator (Soft Floating Bridge) */}
        <div className="relative flex items-center justify-center py-1">
          <div className="w-full border-t border-white/[0.06] absolute" />
          <div className="relative z-10 px-4 py-1.5 bg-slate-900/90 border border-white/[0.09] rounded-full flex items-center gap-2.5 text-xs font-mono text-slate-300 shadow-md backdrop-blur-md">
            <div className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <ArrowDown className="w-2.5 h-2.5" />
            </div>
            <span>1 {selectedAsset.symbol} ≈ ₦1,595.00 NGN</span>
            <span className="cf-badge cf-badge-orange text-[9px] py-0 px-2 font-semibold">
              SOLVER RATE • {countdown}S
            </span>
          </div>
        </div>

        {/* 02 // FIAT SETTLEMENT (NAIRA) */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono text-[10px] font-bold border border-emerald-500/20">
                02
              </span>
              <span className="cf-kicker text-emerald-400">FIAT SETTLEMENT (YOU RECEIVE)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              Direct NIBSS Clearing
            </span>
          </div>

          {/* Calculated Net Naira Output */}
          <div className="w-full bg-gradient-to-r from-emerald-950/20 via-slate-950/70 to-slate-950/70 border border-emerald-500/25 rounded-xl px-5 py-4 flex items-center justify-between shadow-inner">
            <div>
              <div className="text-[10px] font-mono text-emerald-400/90 uppercase tracking-wider mb-0.5">
                Net Payout Amount
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ₦ {quote ? quote.netNgn.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
              </div>
            </div>
            <span className="cf-badge cf-badge-green text-[10px] px-2.5 py-1">
              INSTANT NIBSS
            </span>
          </div>

          {/* Bank & Account Number Inputs */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
              <span>Destination Account</span>
              <span className="text-slate-500 text-[10px]">Commercial & Fintech Banks</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-white/[0.08] focus-within:border-orange-500/50 focus-within:ring-2 focus-within:ring-orange-500/15 rounded-xl px-3.5 py-2.5 transition-all">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">
                  NUBAN Account
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="10-digit NUBAN"
                  className="w-full bg-transparent font-mono text-base font-semibold text-white outline-none tracking-wider"
                />
              </div>

              <button
                onClick={() => setIsBankModalOpen(true)}
                className="w-full bg-slate-950/60 border border-white/[0.08] hover:border-orange-500/40 rounded-xl px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-100 flex items-center justify-between transition-all text-left hover:shadow-lg hover:shadow-orange-500/5"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="text-slate-200 text-xs truncate">{currentBank.name}</div>
                    <div className="text-[10px] text-slate-500 font-sans">Code: {currentBank.code}</div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
              </button>
            </div>

            {/* Real-time FossaPay Bank Resolution Pill */}
            <div className="min-h-[28px] flex items-center">
              {isResolving && (
                <span className="inline-flex items-center gap-2 text-xs font-mono text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>Querying FossaPay Bank Directory...</span>
                </span>
              )}

              {!isResolving && resolvedAccountName && (
                <span className="cf-badge cf-badge-green font-mono text-[11px] flex items-center gap-2 py-1.5 px-3 shadow-sm shadow-emerald-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>✓ NUBAN RESOLVED: {resolvedAccountName}</span>
                </span>
              )}

              {!isResolving && resolveError && (
                <span className="inline-flex items-center gap-2 text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{resolveError}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry & Fees Summary (Soft Tender Details) */}
        <div className="p-4 rounded-xl tender-surface-secondary font-mono text-[11px] space-y-2 text-slate-400">
          <div className="flex justify-between items-center">
            <span>Cross-Chain Route:</span>
            <span className="text-slate-200 font-medium">
              {selectedAsset.chain} ➔ Solana (USDC) via NEAR Solvers
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>FossaPay Payout Fee:</span>
            <span className="text-slate-200 font-medium">₦ 50.00 (Included in quote)</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Estimated Settlement SLA:</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" />
              ~12 Seconds
            </span>
          </div>
        </div>

        {/* Dynamic CTA */}
        {!isConnected ? (
          <button
            onClick={onOpenWalletModal}
            className="w-full py-4 rounded-xl font-mono text-xs font-bold text-white bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/25 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>[ CONNECT WALLET TO OFF-RAMP ]</span>
          </button>
        ) : (
          <button
            disabled={!canSubmit}
            onClick={() => setIsReviewOpen(true)}
            className={`w-full py-4 rounded-xl font-mono text-xs font-bold text-white transition-all duration-200 shadow-xl flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/25 active:scale-[0.99] cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-white/[0.05] cursor-not-allowed shadow-none'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>[ INITIATE OFF-RAMP & EXECUTE INTENT ]</span>
          </button>
        )}
      </div>

      {/* Review Drawer Pre-Flight */}
      {isReviewOpen && quote && resolvedAccountName && (
        <ReviewDrawer
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onConfirm={handleReviewConfirm}
          data={{
            originAsset: selectedAsset,
            amountIn,
            minReceivedUsdc: (parseFloat(amountIn) * 0.9985).toFixed(4),
            netNgn: quote.netNgn,
            accountNumber,
            bankName: currentBank.name,
            accountName: resolvedAccountName,
            exchangeRateNgn: quote.exchangeRateNgn,
          }}
        />
      )}

      {/* Bank Search Modal */}
      <BankSearchModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        banks={banks}
        onSelectBank={(bank) => setSelectedBankCode(bank.code)}
      />

      {/* Token Select Modal */}
      <TokenSelectModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        selectedAsset={selectedAsset}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
      />
    </>
  );
};
