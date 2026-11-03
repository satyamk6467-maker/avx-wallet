// Network + default token configuration for AVX Wallet (BNB Smart Chain only in v0.1)

export type TokenInfo = {
  address: string; // contract address (checksummed)
  symbol: string;
  name: string;
  decimals: number;
  custom?: boolean; // added by the user
};

export type NetworkConfig = {
  key: 'bsc' | 'bscTestnet';
  name: string;
  chainId: number;
  rpcUrls: string[]; // first that works is used
  explorer: string;
  nativeSymbol: string;
  isTestnet: boolean;
  defaultTokens: TokenInfo[];
};

export const NETWORKS: Record<NetworkConfig['key'], NetworkConfig> = {
  bsc: {
    key: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrls: [
      'https://bsc-dataseed.bnbchain.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-rpc.publicnode.com',
    ],
    explorer: 'https://bscscan.com',
    nativeSymbol: 'BNB',
    isTestnet: false,
    defaultTokens: [
      {
        // Tether USD (BSC-USD / BEP-20). Note: 18 decimals on BNB Chain.
        address: '0x55d398326f99059fF775485246999027B3197955',
        symbol: 'USDT',
        name: 'Tether USD (BEP-20)',
        decimals: 18,
      },
    ],
  },
  bscTestnet: {
    key: 'bscTestnet',
    name: 'BNB Chain Testnet',
    chainId: 97,
    rpcUrls: [
      'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
      'https://bsc-testnet-rpc.publicnode.com',
    ],
    explorer: 'https://testnet.bscscan.com',
    nativeSymbol: 'tBNB',
    isTestnet: true,
    // No official USDT on testnet — add any test token via "Add token".
    defaultTokens: [],
  },
};

// Start on testnet so nobody risks real money while trying the app.
export const DEFAULT_NETWORK: NetworkConfig['key'] = 'bscTestnet';

// Standard Ethereum/BNB Chain derivation path (same as Trust Wallet & MetaMask),
// so a seed phrase imported here shows the same address as in those wallets.
export const DERIVATION_PATH = "m/44'/60'/0'/0/0";
