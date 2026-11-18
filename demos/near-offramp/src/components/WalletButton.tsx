'use client';

import { useEffect, useState } from 'react';
import { LogOut, Wallet } from 'lucide-react';
import { Button } from '@fossapay/ui';
import { useNear } from '../providers/NearProvider';
import { WalletModal } from './WalletModal';

export const WALLET_MODAL_EVENT = 'nairabridge:open-wallet';

export function openWalletModal() {
  window.dispatchEvent(new Event(WALLET_MODAL_EVENT));
}

/** Header wallet control. Also listens for `openWalletModal()` so the card CTA can open the same dialog. */
export function WalletButton() {
  const { accountId, isConnected, disconnect } = useNear();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(WALLET_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(WALLET_MODAL_EVENT, onOpen);
  }, []);

  const short = accountId && accountId.length > 18 ? `${accountId.slice(0, 7)}…${accountId.slice(-4)}` : accountId;

  return (
    <>
      {isConnected ? (
        <div className="ml-1 flex items-center gap-1 rounded-xl bg-subtle py-1 pl-3 pr-1 ring-1 ring-inset ring-line">
          <span className="tabular text-sm font-medium text-ink">{short}</span>
          <button onClick={disconnect} title="Disconnect" aria-label="Disconnect wallet" className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-danger">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button size="sm" className="ml-1" onClick={() => setOpen(true)}>
          <Wallet className="h-4 w-4" />
          Connect wallet
        </Button>
      )}
      <WalletModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
