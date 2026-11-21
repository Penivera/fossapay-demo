'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Wallet } from 'lucide-react';
import { Button, Card, Field, Notice, Rows, useMode, cn } from '@fossapay/ui';
import { useNear } from '../providers/NearProvider';
import { BankSearchModal } from './BankSearchModal';
import { TokenSelectModal, ALL_SUPPORTED_ASSETS, type Asset } from './TokenSelectModal';
import { ReviewDrawer } from './ReviewDrawer';
import { openWalletModal } from './WalletButton';

interface Bank {
  name: string;
  code: string;
}

interface Quote {
  quoteId: string;
  depositAddress: string;
  netNgn: number | string;
  exchangeRateNgn: number | string;
  fiatPayoutFeeNgn: number | string;
  minReceivedUsdc?: string;
}

interface OffRampCardProps {
  onInitiate: (details: {
    originAsset: Asset;
    amountIn: string;
    accountNumber: string;
    bankCode: string;
    bankName: string;
    accountName: string;
    netNgn: number | string;
    exchangeRateNgn?: number | string;
    minReceivedUsdc?: string;
    quoteId: string;
    depositAddress: string;
  }) => void;
}

/** Sample balance of the sandbox wallet. Live mode has no balance source, so none is shown. */
const SANDBOX_BALANCE = 240.5;

const ngn = (v: number | string) => Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const OffRampCard: React.FC<OffRampCardProps> = ({ onInitiate }) => {
  const { isConnected } = useNear();
  const { isMock } = useMode();

  // Inputs. Sample values are pre-filled in the sandbox only; live mode starts blank.
  const [selectedAsset, setSelectedAsset] = useState<Asset>(ALL_SUPPORTED_ASSETS[0]);
  const [amountIn, setAmountIn] = useState<string>(isMock ? '50.00' : '');
  const [accountNumber, setAccountNumber] = useState<string>(isMock ? '0123456789' : '');
  const [selectedBankCode, setSelectedBankCode] = useState<string>(isMock ? '999992' : '');

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const basePath = typeof window !== 'undefined' && window.location.pathname.startsWith('/near-offramp') ? '/near-offramp' : '';

  useEffect(() => {
    const t = setInterval(() => setCountdown((p) => (p <= 1 ? 30 : p - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${basePath}/api/banks`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data)) setBanks(data.data);
      } catch (err) {
        console.error('Failed to load banks:', err);
      }
    })();
  }, [basePath]);

  // Resolve the account holder name once 10 digits and a bank are present
  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBankCode) {
      setResolvedAccountName(null);
      setResolveError(null);
      return;
    }
    let live = true;
    setIsResolving(true);
    setResolveError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${basePath}/api/banks/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountNumber, bankCode: selectedBankCode }),
        });
        const json = await res.json();
        if (!live) return;
        if (json.status === 'success' && json.data?.accountName) {
          setResolvedAccountName(json.data.accountName);
        } else {
          setResolvedAccountName(null);
          setResolveError(json.message || 'Account not found');
        }
      } catch {
        if (live) {
          setResolvedAccountName(null);
          setResolveError('Bank directory unreachable');
        }
      } finally {
        if (live) setIsResolving(false);
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [accountNumber, selectedBankCode, basePath]);

  // Quote
  useEffect(() => {
    const parsed = parseFloat(amountIn);
    if (isNaN(parsed) || parsed <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let live = true;
    setIsQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${basePath}/api/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originAsset: selectedAsset, amountIn }),
        });
        const json = await res.json();
        if (!live) return;
        if (json.status === 'success') {
          setQuote(json.data);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(json.message || 'Quote unavailable');
        }
      } catch {
        if (live) setQuoteError('Quote service unreachable');
      } finally {
        if (live) setIsQuoting(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [amountIn, selectedAsset]);

  const currentBank = banks.find((b) => b.code === selectedBankCode);

  const handleQuickPercent = (pct: number) => setAmountIn(((SANDBOX_BALANCE * pct) / 100).toFixed(2));

  const handleReviewConfirm = () => {
    if (!quote || !resolvedAccountName || !currentBank) return;
    setIsReviewOpen(false);
    onInitiate({
      originAsset: selectedAsset,
      amountIn,
      accountNumber,
      bankCode: selectedBankCode,
      bankName: currentBank.name,
      accountName: resolvedAccountName,
      netNgn: quote.netNgn,
      exchangeRateNgn: quote.exchangeRateNgn,
      minReceivedUsdc: quote.minReceivedUsdc,
      quoteId: quote.quoteId,
      depositAddress: quote.depositAddress,
    });
  };

  const canSubmit = isConnected && Boolean(resolvedAccountName) && Boolean(quote) && !isResolving && Boolean(currentBank);

  return (
    <>
      <Card className="space-y-6">
        {/* You pay */}
        <Field
          label="You pay"
          right={
            isMock ? (
              <span className="flex items-center gap-1.5">
                <span className="tabular">Balance {SANDBOX_BALANCE.toFixed(2)}</span>
                {[25, 50, 100].map((p) => (
                  <button key={p} onClick={() => handleQuickPercent(p)} className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-ink-2 transition hover:bg-line">
                    {p === 100 ? 'Max' : `${p}%`}
                  </button>
                ))}
              </span>
            ) : undefined
          }
        >
          <div className="flex items-stretch gap-2.5">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line-strong bg-surface px-4 transition focus-within:border-brand-accent focus-within:ring-4 focus-within:ring-brand-accent/15">
              <input
                inputMode="decimal"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                aria-label="Amount to pay"
                className="tabular h-14 w-full bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none placeholder:text-line-strong"
              />
            </div>
            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="flex min-w-[9.5rem] items-center justify-between gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-left transition hover:border-muted/60 hover:bg-subtle"
            >
              <span>
                <span className="block text-[15px] font-semibold text-ink">{selectedAsset.symbol}</span>
                <span className="block text-xs text-muted">{selectedAsset.chain}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
          </div>
        </Field>

        {/* You receive */}
        <div className="rounded-xl bg-subtle p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-ink-2">You receive</span>
            <span className="text-xs text-muted">Instant bank transfer</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className={cn('tabular text-3xl font-semibold tracking-tight', quote ? 'text-ink' : 'text-line-strong')}>₦{quote ? ngn(quote.netNgn) : '0.00'}</p>
            {isQuoting && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          </div>
          {quote && (
            <p className="tabular mt-1 text-xs text-muted">
              1 {selectedAsset.symbol} ≈ ₦{ngn(quote.exchangeRateNgn)} · rate locked for {countdown}s
            </p>
          )}
        </div>

        {quoteError && <Notice tone={quoteError.toLowerCase().includes('live') ? 'warning' : 'danger'}>{quoteError}</Notice>}

        {/* Destination */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink-2">Send to</p>
          <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr]">
            <input
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="10-digit account number"
              aria-label="Account number"
              className="tabular h-12 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted/70 hover:border-muted/60 focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/15"
            />
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="flex h-12 items-center justify-between gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-left transition hover:border-muted/60 hover:bg-subtle"
            >
              <span className={cn('truncate text-[15px]', currentBank ? 'font-medium text-ink' : 'text-muted')}>{currentBank ? currentBank.name : 'Select bank'}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
            </button>
          </div>

          <div className="flex min-h-7 items-center text-sm">
            {isResolving && (
              <span className="inline-flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying account…
              </span>
            )}
            {!isResolving && resolvedAccountName && (
              <span className="inline-flex items-center gap-2 font-medium text-success-ink">
                <CheckCircle2 className="h-4 w-4 text-success" /> {resolvedAccountName}
              </span>
            )}
            {!isResolving && resolveError && (
              <span className="inline-flex items-center gap-2 font-medium text-danger-ink">
                <AlertCircle className="h-4 w-4" /> {resolveError}
              </span>
            )}
          </div>
        </div>

        {quote && (
          <Rows
            items={[
              { label: 'Route', value: `${selectedAsset.chain} → Solana USDC → NGN` },
              { label: 'Payout fee', value: `₦${ngn(quote.fiatPayoutFeeNgn)} included` },
            ]}
          />
        )}

        {!isConnected ? (
          <Button size="lg" block onClick={openWalletModal}>
            <Wallet className="h-5 w-5" /> Connect wallet to continue
          </Button>
        ) : (
          <Button size="lg" block disabled={!canSubmit} onClick={() => setIsReviewOpen(true)}>
            Review transfer
          </Button>
        )}
      </Card>

      {isReviewOpen && quote && resolvedAccountName && currentBank && (
        <ReviewDrawer
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onConfirm={handleReviewConfirm}
          data={{
            originAsset: selectedAsset,
            amountIn,
            minReceivedUsdc: quote.minReceivedUsdc || (parseFloat(amountIn) * 0.999).toFixed(4),
            netNgn: quote.netNgn,
            accountNumber,
            bankName: currentBank.name,
            accountName: resolvedAccountName,
            exchangeRateNgn: quote.exchangeRateNgn,
          }}
        />
      )}

      <BankSearchModal isOpen={isBankModalOpen} onClose={() => setIsBankModalOpen(false)} banks={banks} selectedBankCode={selectedBankCode} onSelectBank={(b) => setSelectedBankCode(b.code)} />
      <TokenSelectModal isOpen={isTokenModalOpen} onClose={() => setIsTokenModalOpen(false)} selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
    </>
  );
};
