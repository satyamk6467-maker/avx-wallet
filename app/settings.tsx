import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Btn, C, Card, Notice, PinPad, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { NETWORKS, type NetworkConfig } from '../src/lib/networks';
import { settings } from '../src/lib/storage';
import { readMnemonic, verifyPin } from '../src/lib/vault';

function PhraseView({ phrase, onHide }: { phrase: string; onHide: () => void }) {
  usePreventScreenCapture(); // blocks screenshots/recording while the phrase is visible
  return (
    <Screen>
      <Notice tone="red" text="Never share these words. AVX Wallet support will never ask for them." />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {phrase.split(' ').map((w, i) => (
            <Text key={i} style={{ color: C.text, width: '31%' }}>
              <Text style={{ color: C.sub }}>{i + 1}. </Text>
              {w}
            </Text>
          ))}
        </View>
      </Card>
      <Btn title="Hide" onPress={onHide} />
    </Screen>
  );
}

export default function Settings() {
  const { network, setNetwork, lock, removeWallet, address } = useWallet();
  const [bio, setBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [askPin, setAskPin] = useState<null | 'phrase'>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBio(await settings.getBiometric());
      setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
    })();
  }, []);

  if (phrase) return <PhraseView phrase={phrase} onHide={() => setPhrase(null)} />;

  if (askPin) {
    return (
      <Screen scroll={false}>
        <PinPad
          title="Enter PIN"
          subtitle="Required to show your recovery phrase"
          error={pinError}
          onComplete={async (pin) => {
            const res = await verifyPin(pin);
            if (!res.ok) return setPinError(res.lockedFor > 0 ? `Locked for ${res.lockedFor}s.` : 'Wrong PIN.');
            setPinError(null);
            setAskPin(null);
            setPhrase(await readMnemonic());
          }}
        />
        <Btn title="Cancel" kind="secondary" onPress={() => setAskPin(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={T.h2}>Network</Text>
      {(Object.keys(NETWORKS) as NetworkConfig['key'][]).map((k) => {
        const n = NETWORKS[k];
        const sel = n.chainId === network.chainId;
        return (
          <Pressable
            key={k}
            onPress={() => {
              if (sel) return;
              if (!n.isTestnet) {
                Alert.alert('Switch to mainnet?', 'Mainnet uses REAL money. Transactions cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Switch', onPress: () => setNetwork(k) },
                ]);
              } else setNetwork(k);
            }}
          >
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between', borderColor: sel ? C.accent : C.border }}>
              <View>
                <Text style={T.body}>{n.name}</Text>
                <Text style={T.sub}>Chain ID {n.chainId}</Text>
              </View>
              <Text style={{ color: sel ? C.accent : C.sub, fontSize: 20 }}>{sel ? '●' : '○'}</Text>
            </Card>
          </Pressable>
        );
      })}

      <Text style={T.h2}>Security</Text>
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={T.body}>Unlock with biometrics</Text>
          <Text style={T.sub}>{bioAvailable ? 'Fingerprint / Face ID' : 'Not set up on this phone'}</Text>
        </View>
        <Switch
          value={bio}
          disabled={!bioAvailable}
          onValueChange={async (v) => {
            if (v) {
              const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable biometric unlock' });
              if (!r.success) return;
            }
            setBio(v);
            await settings.setBiometric(v);
          }}
        />
      </Card>
      <Btn title="Show recovery phrase" kind="secondary" onPress={() => setAskPin('phrase')} />
      <Btn title="Lock wallet now" kind="secondary" onPress={lock} />

      <Text style={T.h2}>Danger zone</Text>
      <Btn
        title="Remove wallet from this phone"
        kind="danger"
        onPress={() =>
          Alert.alert(
            'Remove wallet?',
            'This deletes the wallet from this phone. Without your recovery phrase your funds are lost forever. Make sure you have it written down.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: removeWallet },
            ],
          )
        }
      />
      <Text style={[T.sub, { textAlign: 'center', fontSize: 11 }]}>
        AVX Wallet v0.1.0 · {address}
      </Text>
    </Screen>
  );
}
