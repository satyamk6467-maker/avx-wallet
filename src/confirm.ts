// Yes/no confirmation that works on phones AND the website.
// (React Native's Alert.alert does nothing in a browser, so on web we use window.confirm.)
import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void | Promise<void>,
  destructive = false,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) void onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => void onConfirm() },
  ]);
}
