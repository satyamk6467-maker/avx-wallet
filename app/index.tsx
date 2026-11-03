import { ActivityIndicator, View } from 'react-native';
import { C } from '../src/ui';

// The root layout's guard redirects from here to welcome / unlock / home.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}
