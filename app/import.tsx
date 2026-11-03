import { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Btn, C, Notice, Screen, T } from '../src/ui';
import { useWallet } from '../src/WalletContext';
import { isValidMnemonic, normalizeMnemonic } from '../src/lib/wallet';

export default function ImportWallet() {
  const router = useRouter();
  const { setPendingMnemonic } = useWallet();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <Screen>
      <Text style={T.sub}>
        Enter your 12 or 24-word recovery phrase from AVX, Trust Wallet, MetaMask or any standard
        wallet. Separate words with spaces.
      </Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        importantForAutofill="no"
        secureTextEntry={false}
        placeholder="word1 word2 word3 …"
        placeholderTextColor={C.sub}
        style={{
          minHeight: 140,
          backgroundColor: C.card,
          borderColor: C.border,
          borderWidth: 1,
          borderRadius: 14,
          color: C.text,
          padding: 14,
          fontSize: 16,
          textAlignVertical: 'top',
        }}
      />
      <Text style={T.sub}>{wordCount} words</Text>
      {error ? <Notice tone="red" text={error} /> : null}
      <Btn
        title="Import"
        disabled={wordCount < 12}
        onPress={() => {
          const phrase = normalizeMnemonic(text);
          if (!isValidMnemonic(phrase)) {
            setError('This recovery phrase is not valid. Check spelling and word order.');
            return;
          }
          setPendingMnemonic(phrase);
          setText('');
          router.push('/set-pin');
        }}
      />
    </Screen>
  );
}
