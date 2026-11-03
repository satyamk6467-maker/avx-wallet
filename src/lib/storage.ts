// Non-secret app settings (custom tokens, network choice, tx history, biometrics flag).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NetworkConfig, TokenInfo } from './networks';

const K_NETWORK = 'avx.network';
const K_BIO = 'avx.biometric';
const kTokens = (chainId: number) => `avx.tokens.${chainId}`;
const kHistory = (chainId: number) => `avx.history.${chainId}`;

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const settings = {
  getNetwork: () => AsyncStorage.getItem(K_NETWORK) as Promise<NetworkConfig['key'] | null>,
  setNetwork: (k: NetworkConfig['key']) => AsyncStorage.setItem(K_NETWORK, k),
  getBiometric: async () => (await AsyncStorage.getItem(K_BIO)) === '1',
  setBiometric: (on: boolean) => AsyncStorage.setItem(K_BIO, on ? '1' : '0'),
};

export async function getCustomTokens(chainId: number): Promise<TokenInfo[]> {
  return getJson<TokenInfo[]>(kTokens(chainId), []);
}

export async function addCustomToken(chainId: number, t: TokenInfo): Promise<void> {
  const list = await getCustomTokens(chainId);
  if (list.some((x) => x.address.toLowerCase() === t.address.toLowerCase())) return;
  await AsyncStorage.setItem(kTokens(chainId), JSON.stringify([...list, { ...t, custom: true }]));
}

export async function removeCustomToken(chainId: number, address: string): Promise<void> {
  const list = await getCustomTokens(chainId);
  await AsyncStorage.setItem(
    kTokens(chainId),
    JSON.stringify(list.filter((x) => x.address.toLowerCase() !== address.toLowerCase())),
  );
}

export type HistoryItem = {
  hash: string;
  symbol: string;
  amount: string;
  to: string;
  time: number;
  status: 'pending' | 'success' | 'failed';
};

export async function getHistory(chainId: number): Promise<HistoryItem[]> {
  return getJson<HistoryItem[]>(kHistory(chainId), []);
}

export async function upsertHistory(chainId: number, item: HistoryItem): Promise<void> {
  const list = (await getHistory(chainId)).filter((x) => x.hash !== item.hash);
  await AsyncStorage.setItem(kHistory(chainId), JSON.stringify([item, ...list].slice(0, 50)));
}

export async function clearAllAppData(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('avx.'));
  await AsyncStorage.multiRemove(keys);
}
