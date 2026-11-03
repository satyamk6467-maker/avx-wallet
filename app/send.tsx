import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { formatUnits } from 'ethers';
import { Btn, C, Card, Notice, PinPad, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import {
  addressFromQr,
  assetKey,
  formatAmount,
  isContract,
  loadAssets,
  maxNativeSendable,
  prepareSend,
  sendPrepared,
  waitForTx,
  type Asset,
  type PreparedTx,
} from '../src/lib/chain';
import { getCustomTokens, upsertHistory } from '../src/lib/storage';
import { verifyPin } from '../src/lib/vault';
import { shortAddress } from '../src/lib/wallet';

type Phase = 'form' | 'review' | 'pin' | 'sending' | 'done';

export default function Send() {
  const router = useRouter();
  const params = useLocalSearchParams<{ asset?: string }>();
  const { signer, address, network } = useWallet();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string>(params.asset ?? 'native');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [tx, setTx] = useState<PreparedTx | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState<'pending' | 'success' | 'failed'>('pending');
  const [pinError, setPinError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();

  const asset = assets.find((a) => assetKey(a) === selected);

  const load = useCallback(async () => {
    if (!address) return;
    const tokens = [...network.defaultTokens, ...(await getCustomTokens(network.chainId))];
    setAssets(await loadAssets(network, address, tokens));
  }, [address, network]);

  useEffect(() => {
    load().catch(() => setError('Could not load balances.'));
  }, [load]);

  if (!signer || !address) return null;

  const review = async () => {
    if (!asset) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      if (to.trim().toLowerCase() === address.toLowerCase()) throw new Error("That's your own address.");
      const prepared = await prepareSend(network, signer, { asset, to: to.trim(), amount });
      if (await isContract(network, to.trim()))
        setWarning('This recipient is a smart contract, not a normal wallet. Make sure it can accept this token, or funds may be lost.');
      setTx(prepared);
      setPhase('review');
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!tx || !asset) return;
    setPhase('sending');
    try {
      const h = await sendPrepared(network, signer, tx);
      setHash(h);
      const item = {
        hash: h,
        symbol: asset.symbol,
        amount: amount.trim(),
        to: to.trim(),
        time: Date.now(),
        status: 'pending' as const,
      };
      await upsertHistory(network.chainId, item);
      setPhase('done');
      const status = await waitForTx(network, h).catch(() => 'pending' as const);
      setResult(status);
      await upsertHistory(network.chainId, { ...item, status });
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? 'Transaction failed to send.');
      setPhase('form');
    }
  };

  // ---------- PIN confirmation ----------
  if (phase === 'pin') {
    return (
      <Screen scroll={false}>
        <PinPad
          title="Enter PIN to confirm"
          subtitle={`Send ${amount} ${asset?.symbol} to ${shortAddress(to.trim())}`}
          error={pinError}
          onComplete={async (pin) => {
            const res = await verifyPin(pin);
            if (res.ok) {
              setPinError(null);
              doSend();
            } else {
              setPinError(res.lockedFor > 0 ? `Locked. Try again in ${res.lockedFor}s.` : 'Wrong PIN.');
            }
          }}
        />
        <Btn title="Cancel" kind="secondary" onPress={() => setPhase('review')} />
      </Screen>
    );
  }

  // ---------- Sending / done ----------
  if (phase === 'sending' || phase === 'done') {
    const color = result === 'success' ? C.green : result === 'failed' ? C.red : C.amber;
    return (
      <Screen>
        <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Text style={{ color, fontSize: 44 }}>
            {phase === 'sending' ? '…' : result === 'success' ? '✓' : result === 'failed' ? '✕' : '⏳'}
          </Text>
          <Text style={T.h2}>
            {phase === 'sending'
              ? 'Broadcasting…'
              : result === 'success'
                ? 'Sent!'
                : result === 'failed'
                  ? 'Transaction failed'
                  : 'Submitted — confirming'}
          </Text>
          <Text style={T.sub}>
            {amount} {asset?.symbol} → {shortAddress(to.trim())}
          </Text>
        </Card>
        {hash ? (
          <Btn title="View on BscScan" kind="secondary" onPress={() => Linking.openURL(`${network.explorer}/tx/${hash}`)} />
        ) : null}
        <Btn title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ---------- Review ----------
  if (phase === 'review' && tx && asset) {
    return (
      <Screen>
        <Card>
          <Row k="Asset" v={`${asset.symbol} (${asset.kind === 'native' ? 'native' : 'BEP-20'})`} />
          <Row k="Amount" v={`${amount.trim()} ${asset.symbol}`} />
          <Row k="To" v={to.trim()} mono />
          <Row k="Network" v={network.name} />
          <Row k="Network fee" v={`~${formatAmount(tx.fee, 18, 8)} ${network.nativeSymbol}`} />
          {asset.kind === 'native' ? (
            <Row k="Total" v={`${formatAmount(tx.value + tx.fee, 18, 8)} ${network.nativeSymbol}`} />
          ) : null}
        </Card>
        {warning ? <Notice tone="red" text={warning} /> : null}
        <Notice text="Blockchain transactions can't be reversed. Double-check the address before confirming." />
        <Btn title="Confirm & send" onPress={() => setPhase('pin')} />
        <Btn title="Edit" kind="secondary" onPress={() => setPhase('form')} />
      </Screen>
    );
  }

  // ---------- Form ----------
  return (
    <Screen>
      <Text style={T.sub}>Asset</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {assets.map((a) => {
          const k = assetKey(a);
          const sel = k === selected;
          return (
            <Pressable
              key={k}
              onPress={() => setSelected(k)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: sel ? C.accent : C.card,
                borderWidth: 1,
                borderColor: sel ? C.accent : C.border,
              }}
            >
              <Text style={{ color: C.text, fontWeight: '600' }}>{a.symbol}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {asset ? (
        <Text style={T.sub}>
          Balance: {asset.formatted} {asset.symbol}
        </Text>
      ) : null}

      <Text style={T.sub}>Recipient address</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={to}
          onChangeText={setTo}
          placeholder="0x…"
          placeholderTextColor={C.sub}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />
        <Pressable
          onPress={async () => {
            if (!perm?.granted && !(await requestPerm()).granted) return;
            setScanning(true);
          }}
          style={{ width: 52, borderRadius: 14, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: C.text, fontSize: 20 }}>⌗</Text>
        </Pressable>
      </View>

      <Text style={T.sub}>Amount</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(t.replace(',', '.'))}
          placeholder="0.0"
          placeholderTextColor={C.sub}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
        <Pressable
          onPress={async () => {
            if (!asset) return;
            const max = asset.kind === 'native' ? await maxNativeSendable(network, asset.raw) : asset.raw;
            setAmount(formatUnits(max, asset.decimals));
          }}
          style={{ paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.cardHi, justifyContent: 'center' }}
        >
          <Text style={{ color: C.accent, fontWeight: '700' }}>MAX</Text>
        </Pressable>
      </View>

      {error ? <Notice tone="red" text={error} /> : null}
      <Btn title="Review" loading={busy} disabled={!asset || !to || !amount} onPress={review} />

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const addr = addressFromQr(data);
              if (addr) {
                setTo(addr);
                setScanning(false);
              }
            }}
          />
          <View style={{ padding: 20 }}>
            <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>
              Point the camera at a wallet address QR code
            </Text>
            <Btn title="Close" kind="secondary" onPress={() => setScanning(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={T.sub}>{k}</Text>
      <Text style={[T.body, mono ? { fontFamily: 'Courier', fontSize: 13 } : null]}>{v}</Text>
    </View>
  );
}

const inputStyle = {
  flex: 1,
  height: 52,
  backgroundColor: C.card,
  borderColor: C.border,
  borderWidth: 1,
  borderRadius: 14,
  color: C.text,
  paddingHorizontal: 14,
  fontSize: 16,
} as const;
