// Web version of the vault (Metro picks this file instead of vault.ts on web).
//
// Browsers have no hardware keystore, so the recovery phrase is ENCRYPTED before it
// touches browser storage:
//   key = PBKDF2-SHA256(PIN, random 16-byte salt, 600,000 iterations)  -> AES-256-GCM
//   localStorage holds only { salt, iv, ciphertext } — never the phrase or the PIN.
// The PIN is checked by trying to decrypt (GCM's auth tag fails on a wrong PIN), so no
// PIN hash is stored. While unlocked, only a non-extractable CryptoKey is kept in memory;
// it is dropped on lock and on page reload.
//
// Limitation: a 6-digit PIN has 1,000,000 combinations. Anyone who copies this browser's
// storage could try them all offline (slowly, because of PBKDF2). For large amounts,
// use the mobile app, whose keystore is hardware-backed.

const K_VAULT = 'avx.vault.v1';
const K_FAILS = 'avx.pinfails.v1'; // "count:lockedUntilMs"
const ITERATIONS = 600_000;
const MAX_FREE_ATTEMPTS = 5;

type Stored = { v: 1; iter: number; salt: string; iv: string; ct: string };

let unlockedKey: CryptoKey | null = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

function store(): Storage {
  if (typeof localStorage === 'undefined') throw new Error('Browser storage is not available.');
  return localStorage;
}

function b64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

function readStored(): Stored | null {
  const raw = store().getItem(K_VAULT);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Stored;
    return s && s.v === 1 ? s : null;
  } catch {
    return null;
  }
}

async function decryptWith(key: CryptoKey, s: Stored): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.ct));
  return dec.decode(pt);
}

export async function hasWallet(): Promise<boolean> {
  return readStored() !== null;
}

export async function saveWallet(mnemonic: string, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)));
  const s: Stored = { v: 1, iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  store().setItem(K_VAULT, JSON.stringify(s));
  store().removeItem(K_FAILS);
  unlockedKey = key;
}

/** Seconds remaining before another PIN attempt is allowed (0 = allowed now). */
export async function pinLockoutSeconds(): Promise<number> {
  const raw = store().getItem(K_FAILS);
  if (!raw) return 0;
  const until = Number(raw.split(':')[1] || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export type PinResult = { ok: true } | { ok: false; lockedFor: number; attemptsLeft: number };

export async function verifyPin(pin: string): Promise<PinResult> {
  const locked = await pinLockoutSeconds();
  if (locked > 0) return { ok: false, lockedFor: locked, attemptsLeft: 0 };

  const s = readStored();
  if (!s) return { ok: false, lockedFor: 0, attemptsLeft: 0 };

  const key = await deriveKey(pin, unb64(s.salt), s.iter);
  try {
    await decryptWith(key, s); // throws on a wrong PIN (GCM tag mismatch)
    store().removeItem(K_FAILS);
    unlockedKey = key;
    return { ok: true };
  } catch {
    const raw = store().getItem(K_FAILS);
    const fails = Number(raw?.split(':')[0] || 0) + 1;
    const lockMs =
      fails >= MAX_FREE_ATTEMPTS ? Math.min(3600_000, 30_000 * 2 ** (fails - MAX_FREE_ATTEMPTS)) : 0;
    store().setItem(K_FAILS, `${fails}:${Date.now() + lockMs}`);
    return {
      ok: false,
      lockedFor: Math.ceil(lockMs / 1000),
      attemptsLeft: Math.max(0, MAX_FREE_ATTEMPTS - fails),
    };
  }
}

/** Read the seed phrase. Works only after saveWallet() or a successful verifyPin(). */
export async function readMnemonic(): Promise<string | null> {
  const s = readStored();
  if (!s || !unlockedKey) return null;
  try {
    return await decryptWith(unlockedKey, s);
  } catch {
    return null;
  }
}

/** Drop the in-memory key (called when the wallet locks). */
export function forgetUnlockKey(): void {
  unlockedKey = null;
}

export async function wipeWallet(): Promise<void> {
  unlockedKey = null;
  store().removeItem(K_VAULT);
  store().removeItem(K_FAILS);
}
