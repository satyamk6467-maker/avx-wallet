# AVX Wallet

A **non-custodial crypto wallet** for **BNB Smart Chain**, built with React Native (Expo) and ethers.js.
Create or import a wallet, hold BNB, USDT (BEP-20) and any BEP-20 token, receive with a QR code, and
send with PIN-confirmed, on-device signing — in the spirit of Trust Wallet.

> Final-year B.Tech Computer Engineering project — Satyam Kumar, Ramrao Adik Institute of Technology (D.Y. Patil University).

---

## Features

| Area | What it does |
|---|---|
| Wallet creation | Generates a 12-word BIP-39 recovery phrase from 128 bits of secure randomness; user must confirm 3 random words before continuing |
| Import | Accepts 12–24 word phrases from AVX, Trust Wallet, MetaMask (same BIP-44 path → same address) |
| Balances | Native BNB + USDT (BEP-20) + any user-added BEP-20 token, pull-to-refresh |
| Receive | QR code + copy/share, with a wrong-network warning (TRC-20 / ERC-20 USDT) |
| Send | Asset picker, QR scanner, MAX button, fee preview, contract-recipient warning, PIN re-confirmation, live confirmation status, BscScan link |
| Custom tokens | Paste a contract address → name/symbol/decimals read on-chain |
| Security | PIN (PBKDF2-hashed), biometric unlock, brute-force lockout, auto-lock, screenshot blocking on phrase screens |
| Networks | BNB Chain Testnet (default, safe for demos) and Mainnet, with a confirmation before switching to real money |

## Architecture

```
┌──────────────────────── React Native app (Expo Router) ────────────────────────┐
│  app/                      Screens: welcome · create · import · set-pin ·       │
│                            unlock · home · send · receive · add-token · settings │
│  src/WalletContext.tsx     App state: locked/unlocked, signer, network,          │
│                            auto-lock, onboarding flow                            │
│  src/lib/wallet.ts         BIP-39 / BIP-44 key derivation (pure, no I/O)         │
│  src/lib/vault.ts          Seed + PIN in iOS Keychain / Android Keystore         │
│  src/lib/chain.ts          RPC (fallback providers), balances, BEP-20, signing   │
│  src/lib/storage.ts        Non-secret prefs: tokens, history, network            │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │ JSON-RPC over HTTPS (signed txs only)
                       ┌───────────────▼───────────────┐
                       │  BNB Smart Chain public RPCs   │
                       │  (3 mainnet / 2 testnet, auto  │
                       │   failover via FallbackProvider)│
                       └───────────────────────────────┘
```

There is **no backend server**. The app talks directly to the blockchain, and private keys never leave the phone.

## Security model

- **Non-custodial:** the recovery phrase is generated on the device and stored only in the hardware-backed
  keystore (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — excluded from cloud backups).
- **Keys in memory only while unlocked:** the signer is dropped on lock and after 60 s in the background.
- **PIN never stored:** only a salted PBKDF2-SHA256 hash (20k iterations). After 5 wrong attempts,
  exponential lockout (30 s → 1 h), persisted so restarting the app doesn't reset it.
- **Every transfer re-asks for the PIN**, even when unlocked.
- **No secrets in navigation params or logs:** the phrase is passed between onboarding screens through
  in-memory React state, not route params.
- **Screenshot/recording blocked** while the phrase can be on screen (`expo-screen-capture`).
- **Pre-sign validation:** address checksum, balance, fee coverage, own-address and smart-contract-recipient checks.
- **Fake-token warning** when adding custom tokens.

Known limitations (good future work): no independent security audit; JS PBKDF2 makes unlock take
~1–3 s on low-end phones (fix: `react-native-quick-crypto` in a dev build); incoming-transaction history
needs an indexer API (currently links to BscScan).

## Tech stack

React Native 0.88 · Expo SDK 58 · Expo Router · TypeScript (strict) · ethers v6 · expo-secure-store ·
expo-local-authentication · expo-camera · react-native-qrcode-svg · Vitest

## Run it

```bash
npm install --legacy-peer-deps
npx expo start            # scan the QR with the Expo Go app (Android/iOS)
```

Get free test BNB from the official BNB Chain testnet faucet, paste your AVX address, and try sending.

Build an installable APK (needs a free Expo account):

```bash
npm i -g eas-cli
eas build -p android --profile preview
```

## Tests

```bash
npm test          # 10 unit tests: key derivation vectors, phrase validation, amount formatting,
                  # QR parsing, BNB + BEP-20 transaction building against a mocked chain
npm run typecheck
```

The derivation test checks against the well-known Hardhat test vector, proving AVX derives the same
address as MetaMask/Trust Wallet for the same phrase.

## Roadmap

- [ ] Tron (TRC-20 USDT) and Bitcoin support (Trust Wallet Core / bitcoinjs-lib)
- [ ] Ethereum & Polygon (multi-EVM)
- [ ] Incoming transaction history via an indexer API
- [ ] Token prices in INR/USD (CoinGecko)
- [ ] WalletConnect v2 for dApps
- [ ] Multiple accounts per phrase

## Disclaimer

Educational project, not audited. Use testnet or small amounts only.

## License

MIT © 2026 Satyam Kumar
