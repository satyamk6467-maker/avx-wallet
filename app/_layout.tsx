// MUST be the first import: gives ethers secure randomness on React Native.
import 'react-native-get-random-values';

import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletProvider, useWallet } from '../src/WalletContext';
import { C } from '../src/ui';

const SETUP_ROUTES = ['welcome', 'create', 'import', 'set-pin'];

function Guard() {
  const { status } = useWallet();
  const segments = useSegments();
  const router = useRouter();
  const current = segments[0] ?? 'index';

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'none' && !SETUP_ROUTES.includes(current)) router.replace('/welcome');
    else if (status === 'locked' && current !== 'unlock') router.replace('/unlock');
    else if (status === 'unlocked' && (SETUP_ROUTES.includes(current) || current === 'unlock' || current === 'index'))
      router.replace('/home');
  }, [status, current, router]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Recovery phrase' }} />
      <Stack.Screen name="import" options={{ title: 'Import wallet' }} />
      <Stack.Screen name="set-pin" options={{ title: 'Set PIN' }} />
      <Stack.Screen name="unlock" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="receive" options={{ title: 'Receive' }} />
      <Stack.Screen name="send" options={{ title: 'Send' }} />
      <Stack.Screen name="add-token" options={{ title: 'Add token' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        {Platform.OS === 'web' ? (
          // On laptops/desktops, keep the app phone-width and centred instead of full-screen.
          <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center' }}>
            <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>
              <Guard />
            </View>
          </View>
        ) : (
          <Guard />
        )}
      </WalletProvider>
    </SafeAreaProvider>
  );
}
