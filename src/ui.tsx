// Shared look & feel for AVX Wallet.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#0B0E14',
  card: '#151A23',
  cardHi: '#1D2430',
  border: '#262E3B',
  text: '#F2F4F8',
  sub: '#8B95A7',
  accent: '#7C5CFF',
  accentSoft: '#2A2350',
  green: '#2ECC8F',
  red: '#FF5C6C',
  amber: '#F5B544',
};

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: 20, gap: 16 }, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20, gap: 16 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Btn({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'primary' ? C.accent : kind === 'danger' ? C.red : C.cardHi;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: off ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Notice({ text, tone = 'amber' }: { text: string; tone?: 'amber' | 'red' | 'green' }) {
  const color = C[tone];
  return (
    <View style={[s.notice, { borderColor: color }]}>
      <Text style={{ color, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export const T = {
  h1: { color: C.text, fontSize: 26, fontWeight: '700' as const },
  h2: { color: C.text, fontSize: 18, fontWeight: '600' as const },
  body: { color: C.text, fontSize: 15, lineHeight: 22 },
  sub: { color: C.sub, fontSize: 13, lineHeight: 19 },
};

/** 6-digit PIN keypad. Calls onComplete when 6 digits are entered. */
export function PinPad({
  title,
  subtitle,
  error,
  busy,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  busy?: boolean;
  onComplete: (pin: string) => void | Promise<void>;
}) {
  const [pin, setPin] = useState('');

  const press = async (k: string) => {
    if (busy) return;
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 6) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 6) {
      await onComplete(next);
      setPin('');
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ alignItems: 'center', gap: 18, paddingTop: 24 }}>
      <Text style={T.h2}>{title}</Text>
      {subtitle ? <Text style={[T.sub, { textAlign: 'center' }]}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 14, marginVertical: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[s.dot, { backgroundColor: i < pin.length ? C.accent : 'transparent' }]}
          />
        ))}
      </View>
      <View style={{ minHeight: 20 }}>
        {busy ? (
          <ActivityIndicator color={C.accent} />
        ) : error ? (
          <Text style={{ color: C.red, textAlign: 'center' }}>{error}</Text>
        ) : null}
      </View>
      <View style={s.pad}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            disabled={!k}
            onPress={() => press(k)}
            style={({ pressed }) => [s.key, { opacity: !k ? 0 : pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '500' }}>{k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#00000033' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.accent },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 270, justifyContent: 'space-between', rowGap: 12 },
  key: {
    width: 78,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
