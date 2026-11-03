import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { C, PinPad, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { settings } from '../src/lib/storage';

export default function Unlock() {
  const { unlockWithPin, unlockTrusted } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioOn, setBioOn] = useState(false);

  const tryBiometric = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AVX Wallet',
      disableDeviceFallback: true,
      cancelLabel: 'Use PIN',
    });
    if (res.success) {
      setBusy(true);
      await unlockTrusted();
    }
  }, [unlockTrusted]);

  useEffect(() => {
    (async () => {
      const enabled = await settings.getBiometric();
      const ok = enabled && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setBioOn(ok);
      if (ok) tryBiometric();
    })();
  }, [tryBiometric]);

  return (
    <Screen scroll={false} style={{ paddingTop: 60 }}>
      <View style={{ alignItems: 'center' }}>
        <Text style={[T.h1, { marginBottom: 4 }]}>AVX Wallet</Text>
      </View>
      <PinPad
        title="Enter your PIN"
        error={error}
        busy={busy}
        onComplete={async (pin) => {
          setBusy(true);
          setError(null);
          const res = await unlockWithPin(pin);
          if (!res.ok) {
            setBusy(false);
            setError(
              res.lockedFor > 0
                ? `Too many wrong PINs. Try again in ${res.lockedFor}s.`
                : `Wrong PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? '' : 's'} left before a lockout.`,
            );
          }
        }}
      />
      {bioOn ? (
        <Pressable onPress={tryBiometric} style={{ alignSelf: 'center', padding: 12 }}>
          <Text style={{ color: C.accent, fontSize: 15 }}>Use fingerprint / Face ID</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
