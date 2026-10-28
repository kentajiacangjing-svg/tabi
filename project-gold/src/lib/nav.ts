import * as Linking from 'expo-linking';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';

export function homeFor(role?: string): Href {
  return role === 'woman' ? '/w' : role === 'admin' ? '/admin' : '/m';
}

export function inviteUrl(code: string) {
  const base = process.env.EXPO_PUBLIC_SITE_URL;
  if (base) return `${base.replace(/\/$/, '')}/invite/${code}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/invite/${code}`;
  return Linking.createURL(`/invite/${code}`);
}
