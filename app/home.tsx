import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { C, Card, Notice, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { assetKey, loadAssets, type Asset } from '../src/lib/chain';
import { getCustomTokens, getHistory, removeCustomToken, type HistoryItem } from '../src/lib/storage';
import { shortAddress } from '../src/lib/wallet';

export default function Home() {
  const router = useRouter();
  const { address, network } = useWallet();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    try {
      const tokens = [...network.defaultTokens, ...(await getCustomTokens(network.chainId))];
      setAssets(await loadAssets(network, address, tokens));
      setError(null);
    } catch {
      setError('Could not reach BNB Chain. Check your internet and pull down to retry.');
    } finally {
      setHistory(await getHistory(network.chainId));
      setRefreshing(false);
    }
  }, [address, network]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    setAssets(null);
  }, [network.chainId]);

  if (!address) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={T.h1}>AVX Wallet</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
            <Text style={{ color: C.sub, fontSize: 26 }}>⚙︎</Text>
          </Pressable>
        </View>

        {/* Account card */}
        <Card style={{ backgroundColor: C.accentSoft, borderColor: C.accent }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={T.sub}>Account 1</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: network.isTestnet ? C.amber : C.green,
              }}
            >
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
                {network.isTestnet ? 'TESTNET' : 'MAINNET'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Text style={[T.h2, { fontFamily: 'Courier' }]}>{shortAddress(address)}</Text>
            <Text style={{ color: C.accent, fontSize: 13 }}>{copied ? 'Copied ✓' : 'Tap to copy address'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Action label="Send" icon="↑" onPress={() => router.push('/send')} />
            <Action label="Receive" icon="↓" onPress={() => router.push('/receive')} />
            <Action label="Add token" icon="+" onPress={() => router.push('/add-token')} />
          </View>
        </Card>

        {error ? <Notice tone="red" text={error} /> : null}

        {/* Assets */}
        <Text style={T.h2}>Assets</Text>
        {assets === null ? (
          <Text style={T.sub}>Loading balances…</Text>
        ) : (
          assets.map((a) => (
            <Pressable
              key={assetKey(a)}
              onPress={() => router.push({ pathname: '/send', params: { asset: assetKey(a) } })}
              onLongPress={() => {
                if (!a.custom) return;
                Alert.alert(`Hide ${a.symbol}?`, 'You can add it again any time.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Hide',
                    style: 'destructive',
                    onPress: async () => {
                      await removeCustomToken(network.chainId, a.address!);
                      refresh();
                    },
                  },
                ]);
              }}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: a.kind === 'native' ? C.amber : a.symbol === 'USDT' ? C.green : C.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>{a.symbol.slice(0, 4)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={T.body}>{a.symbol}</Text>
                  <Text style={T.sub} numberOfLines={1}>
                    {a.name}
                    {a.kind === 'token' ? ' · BEP-20' : ''}
                  </Text>
                </View>
                <Text style={[T.body, { fontWeight: '600' }]}>{a.formatted}</Text>
              </Card>
            </Pressable>
          ))
        )}

        {network.isTestnet ? (
          <Notice text="You're on testnet — coins here have no real value. Get free test BNB from the official BNB Chain faucet to try sending." />
        ) : null}

        {/* History */}
        <Text style={T.h2}>Recent activity</Text>
        {history.length === 0 ? (
          <Text style={T.sub}>Transactions you send from AVX Wallet will appear here.</Text>
        ) : (
          history.map((h) => (
            <Pressable key={h.hash} onPress={() => Linking.openURL(`${network.explorer}/tx/${h.hash}`)}>
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={T.body}>
                    Sent {h.amount} {h.symbol}
                  </Text>
                  <Text style={T.sub}>
                    to {shortAddress(h.to)} · {new Date(h.time).toLocaleString()}
                  </Text>
                </View>
                <Text
                  style={{
                    color: h.status === 'success' ? C.green : h.status === 'failed' ? C.red : C.amber,
                    fontSize: 13,
                  }}
                >
                  {h.status}
                </Text>
              </Card>
            </Pressable>
          ))
        )}
        <Text style={[T.sub, { textAlign: 'center', fontSize: 12 }]}>
          To see incoming transfers, view your address on BscScan.
        </Text>
        <Pressable onPress={() => Linking.openURL(`${network.explorer}/address/${address}`)}>
          <Text style={{ color: C.accent, textAlign: 'center' }}>Open in BscScan ↗</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: C.accent,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{icon}</Text>
      <Text style={{ color: '#fff', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
