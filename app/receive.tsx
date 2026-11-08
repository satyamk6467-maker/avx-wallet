import { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Btn, Card, Notice, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';

export default function Receive() {
  const { address, network } = useWallet();
  const [copied, setCopied] = useState(false);
  if (!address) return null;

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
        <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 16 }}>
          <QRCode value={address} size={220} />
        </View>
        <Text style={[T.sub, { marginTop: 10 }]}>Your {network.name} address</Text>
        <Text selectable style={[T.body, { textAlign: 'center', fontFamily: 'Courier' }]}>
          {address}
        </Text>
      </Card>
      <Notice
        text={`Only send BNB and BEP-20 tokens (like USDT BEP-20) on ${network.name} to this address. Sending USDT on another network (TRC-20, ERC-20) can lose the funds.`}
      />
      <Btn
        title={copied ? 'Copied ✓' : 'Copy address'}
        onPress={async () => {
          await Clipboard.setStringAsync(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      />
      {/* Browsers without a share sheet (most desktops) only get the Copy button. */}
      {Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator) ? (
        <Btn
          title="Share"
          kind="secondary"
          onPress={() =>
            Share.share({ message: `My ${network.name} (BEP-20) address: ${address}` }).catch(() => {})
          }
        />
      ) : null}
    </Screen>
  );
}
