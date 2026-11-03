// Secure storage for the seed phrase and PIN.
// The seed phrase lives ONLY in the phone's hardware-backed keystore
// (iOS Keychain / Android Keystore via expo-secure-store). It is never sent anywhere.
import * as SecureStore from 'expo-secure-store';
import { hexlify, pbkdf2, randomBytes, toUtf8Bytes } from 'ethers';

const K_MNEMONIC = 'avx.mnemonic.v1';
const K_PIN = 'avx.pin.v1'; // "salt:hash" — the PIN itself is never stored
const K_FAILS = 'avx.pinfails.v1'; // "count:lockedUntilMs"

const opts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, // not synced to iCloud backups
};

const PIN_ITERATIONS = 20000;
const MAX_FREE_ATTEMPTS = 5;

function hashPin(pin: string, saltHex: string): string {
  return pbkdf2(toUtf8Bytes(pin), saltHex, PIN_ITERATIONS, 32, 'sha256');
}

export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(K_MNEMONIC, opts)) !== null;
}

export async function saveWallet(mnemonic: string, pin: string): Promise<void> {
  const salt = hexlify(randomBytes(16));
  await SecureStore.setItemAsync(K_MNEMONIC, mnemonic, opts);
  await SecureStore.setItemAsync(K_PIN, `${salt}:${hashPin(pin, salt)}`, opts);
  await SecureStore.deleteItemAsync(K_FAILS, opts);
}

/** Seconds remaining before another PIN attempt is allowed (0 = allowed now). */
export async function pinLockoutSeconds(): Promise<number> {
  const raw = await SecureStore.getItemAsync(K_FAILS, opts);
  if (!raw) return 0;
  const until = Number(raw.split(':')[1] || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export type PinResult = { ok: true } | { ok: false; lockedFor: number; attemptsLeft: number };

export async function verifyPin(pin: string): Promise<PinResult> {
  const locked = await pinLockoutSeconds();
  if (locked > 0) return { ok: false, lockedFor: locked, attemptsLeft: 0 };

  const stored = await SecureStore.getItemAsync(K_PIN, opts);
  if (!stored) return { ok: false, lockedFor: 0, attemptsLeft: 0 };
  const [salt, hash] = stored.split(':');

  if (hashPin(pin, salt) === hash) {
    await SecureStore.deleteItemAsync(K_FAILS, opts);
    return { ok: true };
  }

  const raw = await SecureStore.getItemAsync(K_FAILS, opts);
  const fails = Number(raw?.split(':')[0] || 0) + 1;
  // After 5 wrong PINs: 30s, 60s, 120s, ... lockout (capped at 1 hour).
  const lockMs =
    fails >= MAX_FREE_ATTEMPTS ? Math.min(3600_000, 30_000 * 2 ** (fails - MAX_FREE_ATTEMPTS)) : 0;
  await SecureStore.setItemAsync(K_FAILS, `${fails}:${Date.now() + lockMs}`, opts);
  return {
    ok: false,
    lockedFor: Math.ceil(lockMs / 1000),
    attemptsLeft: Math.max(0, MAX_FREE_ATTEMPTS - fails),
  };
}

/** Read the seed phrase. Callers must verify the PIN / biometrics first. */
export async function readMnemonic(): Promise<string | null> {
  return SecureStore.getItemAsync(K_MNEMONIC, opts);
}

export async function wipeWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(K_MNEMONIC, opts);
  await SecureStore.deleteItemAsync(K_PIN, opts);
  await SecureStore.deleteItemAsync(K_FAILS, opts);
}
