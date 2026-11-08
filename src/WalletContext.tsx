// App-wide wallet state: locked/unlocked, the signer, current network.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { HDNodeWallet } from 'ethers';
import { DEFAULT_NETWORK, NETWORKS, type NetworkConfig } from './lib/networks';
import * as vault from './lib/vault';
import { walletFromMnemonic } from './lib/wallet';
import { clearAllAppData, settings } from './lib/storage';

type Status = 'loading' | 'none' | 'locked' | 'unlocked';

type Ctx = {
  status: Status;
  signer: HDNodeWallet | null;
  address: string | null;
  network: NetworkConfig;
  setNetwork: (k: NetworkConfig['key']) => Promise<void>;
  /** Phrase held in memory only during onboarding (create/import → set PIN). */
  pendingMnemonic: string | null;
  setPendingMnemonic: (m: string | null) => void;
  finishSetup: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<vault.PinResult>;
  unlockTrusted: () => Promise<void>; // after biometrics succeeded
  lock: () => void;
  removeWallet: () => Promise<void>;
};

const WalletContext = createContext<Ctx | null>(null);

const AUTO_LOCK_MS = 60_000; // lock after 1 min in background

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [signer, setSigner] = useState<HDNodeWallet | null>(null);
  const [network, setNet] = useState<NetworkConfig>(NETWORKS[DEFAULT_NETWORK]);
  const [pendingMnemonic, setPendingMnemonic] = useState<string | null>(null);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await settings.getNetwork();
      if (saved && NETWORKS[saved]) setNet(NETWORKS[saved]);
      setStatus((await vault.hasWallet()) ? 'locked' : 'none');
    })();
  }, []);

  const lock = useCallback(() => {
    setSigner(null); // drop the private key from memory
    vault.forgetUnlockKey();
    setStatus((s) => (s === 'unlocked' ? 'locked' : s));
  }, []);

  // Auto-lock when the app sits in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') backgroundAt.current = Date.now();
      else if (st === 'active' && backgroundAt.current) {
        if (Date.now() - backgroundAt.current > AUTO_LOCK_MS) lock();
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [lock]);

  const loadSigner = useCallback(async () => {
    const phrase = await vault.readMnemonic();
    if (!phrase) throw new Error('Wallet not found on this device.');
    // let the UI paint a spinner before the heavy key derivation
    await new Promise((r) => setTimeout(r, 30));
    setSigner(walletFromMnemonic(phrase));
    setStatus('unlocked');
  }, []);

  const finishSetup = useCallback(
    async (pin: string) => {
      if (!pendingMnemonic) throw new Error('No recovery phrase to save.');
      await vault.saveWallet(pendingMnemonic, pin);
      setPendingMnemonic(null);
      await loadSigner();
    },
    [pendingMnemonic, loadSigner],
  );

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const res = await vault.verifyPin(pin);
      if (res.ok) await loadSigner();
      return res;
    },
    [loadSigner],
  );

  const removeWallet = useCallback(async () => {
    await vault.wipeWallet();
    await clearAllAppData();
    setSigner(null);
    setStatus('none');
  }, []);

  const setNetwork = useCallback(async (k: NetworkConfig['key']) => {
    setNet(NETWORKS[k]);
    await settings.setNetwork(k);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        status,
        signer,
        address: signer?.address ?? null,
        network,
        setNetwork,
        pendingMnemonic,
        setPendingMnemonic,
        finishSetup,
        unlockWithPin,
        unlockTrusted: loadSigner,
        lock,
        removeWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): Ctx {
  const c = useContext(WalletContext);
  if (!c) throw new Error('useWallet must be used inside WalletProvider');
  return c;
}
