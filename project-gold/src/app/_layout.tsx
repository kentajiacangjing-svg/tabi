import { CormorantGaramond_500Medium, CormorantGaramond_600SemiBold, useFonts } from '@expo-google-fonts/cormorant-garamond';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider, T, ToastProvider } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { ready, session, me } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready || (session && !me)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <T v="brand">GOLD</T>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  const active = me?.status === 'active';
  const role = active ? me?.role : undefined;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="invite/[code]" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !active}>
        <Stack.Screen name="account-status" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'man'}>
        <Stack.Screen name="m" />
        <Stack.Screen name="woman/[id]" />
        <Stack.Screen name="membership" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'woman'}>
        <Stack.Screen name="w" />
        <Stack.Screen name="accept-settings" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="share" />
        <Stack.Screen name="schedule-new" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={!!role}>
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="support" />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        <Stack.Screen name="safety" />
        <Stack.Screen name="delete-account" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ CormorantGaramond_500Medium, CormorantGaramond_600SemiBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RootStack />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
