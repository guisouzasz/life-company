import '../global.css';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { LC } from '../constants/theme';
import { useAuthStore } from '../store/auth';
import { queryClient } from '../lib/query-client';

function RootNavigator() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tipoUsuario = useAuthStore((s) => s.tipoUsuario);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/');
    else if (tipoUsuario === 'ADMIN') router.replace('/admin/dashboard');
    else if (tipoUsuario === 'PROFESSOR') router.replace('/professor/agenda');
    else router.replace('/dashboard');
  }, [isLoading, isAuthenticated, tipoUsuario]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LC.bg }}>
        <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
        <ActivityIndicator size="large" color={LC.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={LC.bg} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
