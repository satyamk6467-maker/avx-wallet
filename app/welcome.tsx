import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, C, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { generateMnemonic } from '../src/lib/wallet';

export default function Welcome() {
  const router = useRouter();
  const { setPendingMnemonic } = useWallet();

  return (
    <Screen scroll={false} style={{ justifyContent: 'space-between', paddingTop: 80 }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>AVX</Text>
        </View>
        <Text style={[T.h1, { marginTop: 12 }]}>AVX Wallet</Text>
        <Text style={[T.sub, { textAlign: 'center', maxWidth: 300 }]}>
          Your keys, your crypto. Send and receive BNB, USDT and any BEP-20 token on BNB Smart Chain.
        </Text>
      </View>

      <View style={{ gap: 12, marginBottom: 12 }}>
        <Btn
          title="Create a new wallet"
          onPress={() => {
            setPendingMnemonic(generateMnemonic());
            router.push('/create');
          }}
        />
        <Btn title="I already have a wallet" kind="secondary" onPress={() => router.push('/import')} />
        <Text style={[T.sub, { textAlign: 'center', fontSize: 12 }]}>
          AVX Wallet is non-custodial. Nobody — including AVX — can recover your funds if you lose your
          recovery phrase.
        </Text>
      </View>
    </Screen>
  );
}
