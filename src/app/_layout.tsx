import '../global.css';
import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { LC } from '../constants/theme';
import { useAuthStore } from '../store/auth';
import { LimiteDeErro } from '../components/limite-de-erro';
import { queryClient } from '../lib/query-client';

function RootNavigator() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tipoUsuario = useAuthStore((s) => s.tipoUsuario);
  const hydrate = useAuthStore((s) => s.hydrate);
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Só redireciona quando NECESSÁRIO — assim o F5/deep-link preserva a rota:
  //  - deslogado em rota protegida → boas-vindas;
  //  - logado em rota pública (boas-vindas/login/primeiro acesso) → home do papel;
  //  - logado em área de OUTRO papel (ex: aluno em /admin) → home do papel.
  useEffect(() => {
    if (isLoading) return;
    const rotaPublica =
      pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/primeiro-acesso');

    if (!isAuthenticated) {
      if (!rotaPublica) router.replace('/');
      return;
    }

    const home =
      tipoUsuario === 'ADMIN' ? '/admin/dashboard'
      : tipoUsuario === 'PROFESSOR' ? '/professor/agenda'
      : '/dashboard';
    const areaCorreta =
      tipoUsuario === 'ADMIN' ? pathname.startsWith('/admin')
      : tipoUsuario === 'PROFESSOR' ? pathname.startsWith('/professor')
      : !pathname.startsWith('/admin') && !pathname.startsWith('/professor');

    if (rotaPublica || !areaCorreta) router.replace(home as any);
  }, [isLoading, isAuthenticated, tipoUsuario, pathname]);

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
      {/* Nome da aba do navegador. Fica aqui, e não no RootNavigator, porque
          aquele componente sai pelo caminho do carregamento antes de chegar
          no conteúdo — e é justamente esse primeiro render que vira o HTML
          publicado. Também não basta pôr no +html: o expo-router injeta um
          <title> próprio antes do nosso, e o navegador usa o primeiro. */}
      <Head>
        <title>Academia Life Company</title>
      </Head>
      {/* Erro em qualquer tela vira mensagem com botão, e não tela branca. */}
      <LimiteDeErro>
        <RootNavigator />
      </LimiteDeErro>
    </QueryClientProvider>
  );
}
