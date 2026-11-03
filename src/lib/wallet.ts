// Seed phrase + key derivation (pure functions, no storage, no network).
import { HDNodeWallet, Mnemonic, randomBytes } from 'ethers';
import { DERIVATION_PATH } from './networks';

/** Create a brand-new 12-word recovery phrase (128 bits of secure randomness). */
export function generateMnemonic(): string {
  return Mnemonic.fromEntropy(randomBytes(16)).phrase;
}

/** Normalise whatever the user typed/pasted: lowercase, single spaces. */
export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidMnemonic(phrase: string): boolean {
  const words = phrase.split(' ').length;
  if (![12, 15, 18, 21, 24].includes(words)) return false;
  return Mnemonic.isValidMnemonic(phrase);
}

/** Derive the account wallet (signer) from the phrase. Slow-ish (~1–3 s on phones). */
export function walletFromMnemonic(phrase: string): HDNodeWallet {
  return HDNodeWallet.fromPhrase(phrase, undefined, DERIVATION_PATH);
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
