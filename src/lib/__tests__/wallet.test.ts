import { describe, expect, it } from 'vitest';
import { Interface, parseUnits, type Provider } from 'ethers';
import {
  generateMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  shortAddress,
  walletFromMnemonic,
} from '../wallet';
import { addressFromQr, formatAmount, prepareSend, setProviderForTesting, type Asset } from '../chain';
import { NETWORKS } from '../networks';

// Well-known public test phrase (Hardhat/Foundry). NEVER use it for real funds.
const TEST_PHRASE = 'test test test test test test test test test test test junk';
const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('seed phrase', () => {
  it('generates valid, unique 12-word phrases', () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a.split(' ')).toHaveLength(12);
    expect(isValidMnemonic(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('derives the same address as MetaMask / Trust Wallet (BIP-44 m/44\'/60\'/0\'/0/0)', () => {
    expect(walletFromMnemonic(TEST_PHRASE).address).toBe(TEST_ADDRESS);
  });

  it('normalises messy user input', () => {
    expect(normalizeMnemonic('  TEST test\n test   test test test test test test test test junk ')).toBe(
      TEST_PHRASE,
    );
  });

  it('rejects invalid phrases (bad checksum, wrong length, typos)', () => {
    expect(isValidMnemonic('test test test test test test test test test test test test')).toBe(false);
    expect(isValidMnemonic('test test test')).toBe(false);
    expect(isValidMnemonic(TEST_PHRASE.replace('junk', 'junkk'))).toBe(false);
  });

  it('shortens addresses for display', () => {
    expect(shortAddress(TEST_ADDRESS)).toBe('0xf39F…2266');
  });
});

describe('amount formatting', () => {
  it('formats with thousands separators and trims zeros', () => {
    expect(formatAmount(parseUnits('1234567.5', 18), 18)).toBe('1,234,567.5');
    expect(formatAmount(parseUnits('0.000001234', 18), 18)).toBe('0.000001');
    expect(formatAmount(0n, 18)).toBe('0');
  });
});

describe('QR parsing', () => {
  it('reads plain and EIP-681 style QR payloads', () => {
    expect(addressFromQr(TEST_ADDRESS.toLowerCase())).toBe(TEST_ADDRESS);
    expect(addressFromQr(`ethereum:${TEST_ADDRESS}@56?value=1e18`)).toBe(TEST_ADDRESS);
    expect(addressFromQr('hello world')).toBeNull();
  });
});

describe('transaction preparation (mocked chain)', () => {
  const net = NETWORKS.bscTestnet;
  const signer = walletFromMnemonic(TEST_PHRASE);
  const gasPrice = parseUnits('3', 'gwei');

  // Replace the network provider with a fake one so tests run offline.
  const fake = {
    getFeeData: async () => ({ gasPrice }),
    getBalance: async () => parseUnits('1', 18),
    estimateGas: async () => 50_000n,
  };
  setProviderForTesting(net.chainId, fake as unknown as Provider);

  const native: Asset = {
    kind: 'native', symbol: 'tBNB', name: 'BNB', decimals: 18,
    raw: parseUnits('1', 18), formatted: '1',
  };
  const usdt: Asset = {
    kind: 'token', symbol: 'USDT', name: 'Tether', decimals: 18,
    address: '0x55d398326f99059fF775485246999027B3197955',
    raw: parseUnits('100', 18), formatted: '100',
  };
  const to = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  it('builds a native BNB transfer with correct fee', async () => {
    const tx = await prepareSend(net, signer, { asset: native, to, amount: '0.5' });
    expect(tx.value).toBe(parseUnits('0.5', 18));
    expect(tx.gasLimit).toBe(21000n);
    expect(tx.fee).toBe(21000n * gasPrice);
  });

  it('encodes a BEP-20 transfer(to, amount) call with a 20% gas buffer', async () => {
    const tx = await prepareSend(net, signer, { asset: usdt, to, amount: '25' });
    const iface = new Interface(['function transfer(address,uint256)']);
    const [decodedTo, decodedAmt] = iface.decodeFunctionData('transfer', tx.data!);
    expect(decodedTo).toBe(to);
    expect(decodedAmt).toBe(parseUnits('25', 18));
    expect(tx.to).toBe(usdt.address);
    expect(tx.value).toBe(0n);
    expect(tx.gasLimit).toBe(60_000n);
  });

  it('refuses bad input before anything is signed', async () => {
    await expect(prepareSend(net, signer, { asset: native, to: '0x123', amount: '1' })).rejects.toThrow(/not valid/);
    await expect(prepareSend(net, signer, { asset: usdt, to, amount: '1000' })).rejects.toThrow(/Not enough/);
    await expect(prepareSend(net, signer, { asset: usdt, to, amount: 'abc' })).rejects.toThrow(/valid amount/);
    await expect(prepareSend(net, signer, { asset: native, to, amount: '1' })).rejects.toThrow(/network fee/);
  });

});
