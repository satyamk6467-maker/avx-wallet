import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, C, Card, Notice, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { fetchTokenInfo } from '../src/lib/chain';
import { addCustomToken } from '../src/lib/storage';
import type { TokenInfo } from '../src/lib/networks';

export default function AddToken() {
  const router = useRouter();
  const { network } = useWallet();
  const [addr, setAddr] = useState('');
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <Text style={T.sub}>
        Paste the BEP-20 token contract address on {network.name}. AVX Wallet reads the name, symbol
        and decimals from the contract itself.
      </Text>
      <TextInput
        value={addr}
        onChangeText={(t) => {
          setAddr(t.trim());
          setInfo(null);
          setError(null);
        }}
        placeholder="0x… token contract"
        placeholderTextColor={C.sub}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          height: 52,
          backgroundColor: C.card,
          borderColor: C.border,
          borderWidth: 1,
          borderRadius: 14,
          color: C.text,
          paddingHorizontal: 14,
          fontSize: 15,
        }}
      />
      {error ? <Notice tone="red" text={error} /> : null}
      {info ? (
        <>
          <Card>
            <Text style={T.h2}>{info.symbol}</Text>
            <Text style={T.body}>{info.name}</Text>
            <Text style={T.sub}>Decimals: {info.decimals}</Text>
          </Card>
          <Notice text="Anyone can create a token with any name — including fake USDT. Only add tokens whose contract address you got from an official source." />
          <Btn
            title={`Add ${info.symbol}`}
            onPress={async () => {
              await addCustomToken(network.chainId, info);
              router.back();
            }}
          />
        </>
      ) : (
        <Btn
          title="Look up token"
          loading={busy}
          disabled={!addr}
          onPress={async () => {
            setBusy(true);
            try {
              setInfo(await fetchTokenInfo(network, addr));
            } catch (e: any) {
              setError(e?.message?.length < 120 ? e.message : 'This does not look like a BEP-20 token contract.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Screen>
  );
}
