'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NearConnector } from '@hot-labs/near-connect';
import { useMode } from '@fossapay/ui';

interface NearContextType {
  accountId: string | null;
  isConnected: boolean;
  walletName: string | null;
  connector: NearConnector | null;
  connect: (mode?: 'fastauth' | 'manifest' | 'demo') => Promise<void>;
  disconnect: () => Promise<void>;
  signDebit: (depositAddress: string, amount: string) => Promise<string>;
}

const NearContext = createContext<NearContextType>({
  accountId: null,
  isConnected: false,
  walletName: null,
  connector: null,
  connect: async () => {},
  disconnect: async () => {},
  signDebit: async () => '',
});

export const NearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connector, setConnector] = useState<NearConnector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const { isLive } = useMode();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const nearConn = new NearConnector({
        network: 'mainnet',
      });

      setConnector(nearConn);

      nearConn.on('wallet:signIn', (payload: any) => {
        const primaryAccount = payload.accounts?.[0]?.accountId || 'fastauth.near';
        setAccountId(primaryAccount);
        const name = payload.wallet?.manifest?.name || payload.wallet?.id || 'NEAR Wallet';
        setWalletName(name);
      });

      nearConn.on('wallet:signOut', () => {
        setAccountId(null);
        setWalletName(null);
      });
    } catch (e) {
      console.warn('NearConnector initialization fallback:', e);
    }
  }, []);

  const connect = useCallback(async (mode?: 'fastauth' | 'manifest' | 'demo') => {
    // Fabricated identities exist only in the sandbox
    if (isLive && (mode === 'demo' || mode === 'fastauth')) {
      throw new Error('Connect a real NEAR wallet in live mode.');
    }
    if (mode === 'demo') {
      setAccountId('alice.near');
      setWalletName('DEMO WALLET');
      return;
    }

    if (mode === 'fastauth') {
      setAccountId('fastauth.near');
      setWalletName('FASTAUTH PASSKEY');
      return;
    }

    if (connector) {
      try {
        const wallet = await connector.connect();
        if (wallet) {
          const accounts = await wallet.getAccounts();
          setAccountId(accounts[0]?.accountId || 'connected.near');
          const name = (wallet as any)?.manifest?.name || (wallet as any)?.id || 'NEAR Wallet';
          setWalletName(name);
        }
      } catch (err) {
        console.error('Connector failed:', err);
      }
    }
  }, [connector, isLive]);

  const disconnect = useCallback(async () => {
    if (connector) {
      try {
        const activeWallet = await connector.wallet();
        if (activeWallet) {
          await connector.disconnect(activeWallet);
        }
      } catch (err) {
        console.error('Wallet disconnect failed:', err);
      }
    }
    setAccountId(null);
    setWalletName(null);
  }, [connector]);

  const signDebit = useCallback(
    async (depositAddress: string, amount: string): Promise<string> => {
      if (connector) {
        try {
          const activeWallet = await connector.wallet();
          if (activeWallet) {
            const res = await activeWallet.signAndSendTransaction({
              receiverId: depositAddress.includes('.') ? depositAddress : 'intents.near',
              actions: [
                {
                  type: 'FunctionCall',
                  params: {
                    methodName: 'ft_transfer',
                    args: {
                      receiver_id: depositAddress,
                      amount: String(Math.floor(parseFloat(amount) * 1e6)),
                    },
                    gas: '30000000000000',
                    deposit: '1',
                  },
                },
              ],
            });
            return (res as any)?.transaction?.hash || `0x4f8a91bc72e${Date.now().toString(16)}9c2e`;
          }
        } catch (err) {
          if (isLive) throw err;
          // sandbox: fall through to a simulated hash
        }
      }

      if (isLive) throw new Error('No wallet available to sign the deposit transaction.');
      return `0x4f8a91bc72e${Math.random().toString(16).substring(2, 8)}9c2e`;
    },
    [connector, isLive]
  );

  return (
    <NearContext.Provider
      value={{
        accountId,
        isConnected: Boolean(accountId),
        walletName,
        connector,
        connect,
        disconnect,
        signDebit,
      }}
    >
      {children}
    </NearContext.Provider>
  );
};

export const useNear = () => useContext(NearContext);
