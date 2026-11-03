import { useState } from 'react';
import { Screen, PinPad } from '../src/ui';
import { useWallet } from '../src/WalletContext';

export default function SetPin() {
  const { finishSetup } = useWallet();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen scroll={false}>
      <PinPad
        title={first ? 'Confirm your PIN' : 'Create a 6-digit PIN'}
        subtitle="You'll use this PIN to unlock AVX Wallet and approve transactions."
        error={error}
        busy={busy}
        onComplete={async (pin) => {
          if (!first) {
            if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') {
              setError('That PIN is too easy to guess. Pick another.');
              return;
            }
            setError(null);
            setFirst(pin);
            return;
          }
          if (pin !== first) {
            setError("PINs don't match. Start again.");
            setFirst(null);
            return;
          }
          setBusy(true);
          try {
            await finishSetup(pin); // guard in _layout moves us to /home
          } catch (e: any) {
            setError(e?.message ?? 'Could not save wallet.');
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
