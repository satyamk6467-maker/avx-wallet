// Talking to BNB Chain: balances, token info, fees, sending.
import {
  Contract,
  FallbackProvider,
  JsonRpcProvider,
  Network,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type HDNodeWallet,
  type Provider,
} from 'ethers';
import type { NetworkConfig, TokenInfo } from './networks';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const providers = new Map<number, Provider>();

export function getProvider(net: NetworkConfig): Provider {
  let p = providers.get(net.chainId);
  if (!p) {
    const network = Network.from(net.chainId);
    const rpcs = net.rpcUrls.map(
      (url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: network }),
        priority: i + 1,
        stallTimeout: 2500,
      }),
    );
    p = rpcs.length === 1 ? rpcs[0].provider : new FallbackProvider(rpcs, network, { quorum: 1 });
    providers.set(net.chainId, p);
  }
  return p;
}

/** Test hook: swap in a fake provider so logic can be tested offline. */
export function setProviderForTesting(chainId: number, provider: Provider): void {
  providers.set(chainId, provider);
}

export type Asset = {
  kind: 'native' | 'token';
  symbol: string;
  name: string;
  decimals: number;
  address?: string; // token contract
  raw: bigint; // balance in smallest unit
  formatted: string;
  custom?: boolean;
};

export function assetKey(a: Asset): string {
  return a.kind === 'native' ? 'native' : a.address!;
}

export function formatAmount(raw: bigint, decimals: number, maxFrac = 6): string {
  const s = formatUnits(raw, decimals);
  const [int, frac = ''] = s.split('.');
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, '');
  const intGrouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return trimmed ? `${intGrouped}.${trimmed}` : intGrouped;
}

export async function loadAssets(
  net: NetworkConfig,
  owner: string,
  tokens: TokenInfo[],
): Promise<Asset[]> {
  const provider = getProvider(net);
  const native = provider.getBalance(owner).then<Asset>((raw) => ({
    kind: 'native',
    symbol: net.nativeSymbol,
    name: net.isTestnet ? 'BNB (Testnet)' : 'BNB',
    decimals: 18,
    raw,
    formatted: formatAmount(raw, 18),
  }));

  const tokenAssets = tokens.map(async (t): Promise<Asset> => {
    let raw = 0n;
    try {
      raw = await new Contract(t.address, ERC20_ABI, provider).balanceOf(owner);
    } catch {
      // keep 0 if a token call fails; don't break the whole list
    }
    return {
      kind: 'token',
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      address: t.address,
      raw,
      formatted: formatAmount(raw, t.decimals),
      custom: t.custom,
    };
  });

  return Promise.all([native, ...tokenAssets]);
}

/** Look up a BEP-20 token's name/symbol/decimals from its contract. */
export async function fetchTokenInfo(net: NetworkConfig, address: string): Promise<TokenInfo> {
  if (!isAddress(address)) throw new Error('That is not a valid contract address.');
  const provider = getProvider(net);
  const addr = getAddress(address);
  const code = await provider.getCode(addr);
  if (code === '0x') throw new Error(`No contract found at this address on ${net.name}.`);
  const c = new Contract(addr, ERC20_ABI, provider);
  const [name, symbol, decimals] = await Promise.all([c.name(), c.symbol(), c.decimals()]);
  return { address: addr, name: String(name), symbol: String(symbol), decimals: Number(decimals), custom: true };
}

/** Does this address hold contract code? (Used to warn before sending.) */
export async function isContract(net: NetworkConfig, address: string): Promise<boolean> {
  return (await getProvider(net).getCode(address)) !== '0x';
}

export type SendRequest = {
  asset: Asset;
  to: string;
  amount: string; // human units, e.g. "12.5"
};

export type PreparedTx = {
  to: string;
  data?: string;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  fee: bigint; // in native wei
  amountRaw: bigint;
};

export async function prepareSend(
  net: NetworkConfig,
  signer: HDNodeWallet,
  req: SendRequest,
): Promise<PreparedTx> {
  if (!isAddress(req.to)) throw new Error('Recipient address is not valid.');
  const to = getAddress(req.to);
  let amountRaw: bigint;
  try {
    amountRaw = parseUnits(req.amount.trim(), req.asset.decimals);
  } catch {
    throw new Error('Enter a valid amount.');
  }
  if (amountRaw <= 0n) throw new Error('Amount must be greater than 0.');
  if (amountRaw > req.asset.raw) throw new Error(`Not enough ${req.asset.symbol}.`);

  const provider = getProvider(net);
  const from = signer.address;
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? parseUnits('1', 'gwei');
  const balance = await provider.getBalance(from);

  if (req.asset.kind === 'native') {
    const gasLimit = 21000n;
    const fee = gasLimit * gasPrice;
    if (amountRaw + fee > balance)
      throw new Error(`Not enough ${net.nativeSymbol} to cover amount + network fee.`);
    return { to, value: amountRaw, gasLimit, gasPrice, fee, amountRaw };
  }

  const token = new Contract(req.asset.address!, ERC20_ABI, provider);
  const data = token.interface.encodeFunctionData('transfer', [to, amountRaw]);
  const est = await provider.estimateGas({ from, to: req.asset.address!, data });
  const gasLimit = (est * 120n) / 100n; // +20% safety margin
  const fee = gasLimit * gasPrice;
  if (fee > balance)
    throw new Error(`You need a little ${net.nativeSymbol} to pay the network fee for token transfers.`);
  return { to: req.asset.address!, data, value: 0n, gasLimit, gasPrice, fee, amountRaw };
}

/** Largest native amount that can be sent while leaving room for the fee. */
export async function maxNativeSendable(net: NetworkConfig, balance: bigint): Promise<bigint> {
  const feeData = await getProvider(net).getFeeData();
  const fee = 21000n * (feeData.gasPrice ?? parseUnits('1', 'gwei'));
  return balance > fee ? balance - fee : 0n;
}

export async function sendPrepared(
  net: NetworkConfig,
  signer: HDNodeWallet,
  tx: PreparedTx,
): Promise<string> {
  const connected = signer.connect(getProvider(net));
  const sent = await connected.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gasLimit: tx.gasLimit,
    gasPrice: tx.gasPrice, // BNB Chain uses legacy gas pricing
    chainId: net.chainId,
    type: 0,
  });
  return sent.hash;
}

export async function waitForTx(net: NetworkConfig, hash: string): Promise<'success' | 'failed'> {
  const receipt = await getProvider(net).waitForTransaction(hash, 1, 120_000);
  return receipt && receipt.status === 1 ? 'success' : 'failed';
}

/** Pull a 0x address out of a QR payload like "ethereum:0xabc...@56?value=1". */
export function addressFromQr(data: string): string | null {
  const m = data.match(/0x[a-fA-F0-9]{40}/);
  return m && isAddress(m[0]) ? getAddress(m[0]) : null;
}
