// Show the new recovery phrase, then make the user prove they wrote it down.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Btn, C, Card, Notice, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';

function pickChecks(count: number): number[] {
  const idx = new Set<number>();
  while (idx.size < 3) idx.add(Math.floor(Math.random() * count));
  return [...idx].sort((a, b) => a - b);
}

export default function CreateWallet() {
  const router = useRouter();
  const { pendingMnemonic } = useWallet();
  usePreventScreenCapture(); // no screenshots while the phrase can be on screen
  const words = useMemo(() => pendingMnemonic?.split(' ') ?? [], [pendingMnemonic]);
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState<'show' | 'verify'>('show');
  const checks = useMemo(() => pickChecks(words.length), [words]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  // word choices for each check: correct word + 3 others from the phrase/shuffled
  const choices = useMemo(() => {
    const out: Record<number, string[]> = {};
    for (const i of checks) {
      const pool = words.filter((_, j) => j !== i).sort(() => Math.random() - 0.5).slice(0, 3);
      out[i] = [...pool, words[i]].sort(() => Math.random() - 0.5);
    }
    return out;
  }, [checks, words]);

  if (!pendingMnemonic) {
    return (
      <Screen>
        <Text style={T.body}>Something went wrong. Go back and start again.</Text>
        <Btn title="Back" onPress={() => router.replace('/welcome')} />
      </Screen>
    );
  }

  if (step === 'verify') {
    const done = checks.every((i) => answers[i]);
    return (
      <Screen>
        <Text style={T.h2}>Confirm your phrase</Text>
        <Text style={T.sub}>Tap the correct word for each position.</Text>
        {checks.map((i) => (
          <Card key={i}>
            <Text style={T.body}>Word #{i + 1}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {choices[i].map((w, k) => {
                const sel = answers[i] === w;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setAnswers((a) => ({ ...a, [i]: w }))}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: sel ? C.accent : C.cardHi,
                    }}
                  >
                    <Text style={{ color: C.text }}>{w}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ))}
        {error ? <Notice tone="red" text={error} /> : null}
        <Btn
          title="Continue"
          disabled={!done}
          onPress={() => {
            if (checks.every((i) => answers[i] === words[i])) {
              setError(null);
              router.push('/set-pin');
            } else {
              setError('Some words are wrong. Check your written copy and try again.');
              setAnswers({});
            }
          }}
        />
        <Btn title="Show phrase again" kind="secondary" onPress={() => setStep('show')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice
        text="Write these words on paper in order and keep them safe. Anyone with this phrase can take all your funds. Never share it, never type it into a website, never screenshot it."
      />
      <Card style={{ minHeight: 220 }}>
        {revealed ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
            {words.map((w, i) => (
              <View
                key={i}
                style={{
                  width: '31%',
                  backgroundColor: C.cardHi,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                }}
              >
                <Text style={{ color: C.text, fontSize: 14 }}>
                  <Text style={{ color: C.sub }}>{i + 1}. </Text>
                  {w}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => setRevealed(true)}
            style={{ flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={T.body}>Tap to reveal your recovery phrase</Text>
            <Text style={T.sub}>Make sure no one is watching your screen.</Text>
          </Pressable>
        )}
      </Card>
      <Btn title="I've written it down" disabled={!revealed} onPress={() => setStep('verify')} />
    </Screen>
  );
}
