import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { LC } from '../constants/theme';
import { AuthProvider, useAuthStore } from '../store/auth';

function RootLayout() {
  const { isLoading, isAuthenticated, tipoUsuario, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) router.replace('/');
      else if (tipoUsuario === 'ADMIN') router.replace('/admin/dashboard');
      else router.replace('/dashboard');
    }
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
    <AuthProvider>
      <RootLayout />
    </AuthProvider>
  );
}
