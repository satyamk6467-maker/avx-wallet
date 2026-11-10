// Web version of the vault (Metro picks this file instead of vault.ts in the browser).
// Browsers have no hardware keystore, so the recovery phrase is ENCRYPTED with a key derived
// from the PIN (PBKDF2-SHA256, 600k iterations -> AES-256-GCM) before it is stored in localStorage.
// The decryption key lives only in memory while unlocked and is forgotten on lock.
// A wrong PIN fails AES-GCM authentication, so no PIN hash is stored at all.

const K_VAULT = 'avx.vault.v1'; // JSON { salt, iv, ct } (base64)
const K_FAILS = 'avx.pinfails.v1'; // "count:lockedUntilMs"

const PBKDF2_ITERATIONS = 600_000;
const MAX_FREE_ATTEMPTS = 5;

let sessionKey: CryptoKey | null = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

type Blob = { salt: string; iv: string; ct: string };

function readBlob(): Blob | null {
  const raw = localStorage.getItem(K_VAULT);
  return raw ? (JSON.parse(raw) as Blob) : null;
}

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: JS can use the key but never read its bytes
    ['encrypt', 'decrypt'],
  );
}

async function decryptWith(key: CryptoKey, blob: Blob): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return dec.decode(pt);
}

export async function hasWallet(): Promise<boolean> {
  return readBlob() !== null;
}

export async function saveWallet(mnemonic: string, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)));
  localStorage.setItem(K_VAULT, JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
  localStorage.removeItem(K_FAILS);
  sessionKey = key;
}

/** Seconds remaining before another PIN attempt is allowed (0 = allowed now). */
export async function pinLockoutSeconds(): Promise<number> {
  const raw = localStorage.getItem(K_FAILS);
  if (!raw) return 0;
  const until = Number(raw.split(':')[1] || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export type PinResult = { ok: true } | { ok: false; lockedFor: number; attemptsLeft: number };

export async function verifyPin(pin: string): Promise<PinResult> {
  const locked = await pinLockoutSeconds();
  if (locked > 0) return { ok: false, lockedFor: locked, attemptsLeft: 0 };

  const blob = readBlob();
  if (!blob) return { ok: false, lockedFor: 0, attemptsLeft: 0 };

  try {
    const key = await deriveKey(pin, unb64(blob.salt));
    await decryptWith(key, blob); // throws if the PIN is wrong
    sessionKey = key;
    localStorage.removeItem(K_FAILS);
    return { ok: true };
  } catch {
    const fails = Number(localStorage.getItem(K_FAILS)?.split(':')[0] || 0) + 1;
    const lockMs =
      fails >= MAX_FREE_ATTEMPTS ? Math.min(3600_000, 30_000 * 2 ** (fails - MAX_FREE_ATTEMPTS)) : 0;
    localStorage.setItem(K_FAILS, `${fails}:${Date.now() + lockMs}`);
    return {
      ok: false,
      lockedFor: Math.ceil(lockMs / 1000),
      attemptsLeft: Math.max(0, MAX_FREE_ATTEMPTS - fails),
    };
  }
}

/** Read the seed phrase. Only works after verifyPin / saveWallet in this session. */
export async function readMnemonic(): Promise<string | null> {
  const blob = readBlob();
  if (!blob || !sessionKey) return null;
  return decryptWith(sessionKey, blob);
}

/** Drop the decryption key from memory (called on lock). */
export function forgetKey(): void {
  sessionKey = null;
}

export async function wipeWallet(): Promise<void> {
  localStorage.removeItem(K_VAULT);
  localStorage.removeItem(K_FAILS);
  sessionKey = null;
}
