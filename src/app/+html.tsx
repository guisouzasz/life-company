import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Casca HTML de todas as páginas do site (só web; no app nativo isto não roda).
 *
 * Sem este arquivo o Expo gerava a página com `lang="en"` e `<title>` vazio:
 * a aba do navegador ficava sem nome, e quem deixa o sistema aberto o dia
 * inteiro não achava a aba entre as outras. Também é daqui que sai o manifest
 * que deixa o sistema instalável, com janela própria e ícone na área de
 * trabalho — que é como a dona e os professores vão abrir isto.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover: o tablet e o iPhone com notch usam a tela toda */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* O <title> sai de app/_layout.tsx: o expo-router injeta a tag dele
            antes desta, e o navegador usa a primeira que encontra. */}
        <meta name="description" content="Sistema da Academia Life Company: agenda, treinos e frequência." />

        {/* A fonte vem daqui, e não de um @import no CSS: assim o navegador
            já a descobre no HTML e baixa em paralelo, em vez de esperar o CSS
            baixar para só então descobrir que precisa dela. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />

        {/* Instalável: ícone na área de trabalho e janela sem barra de endereço */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#028E94" />
        <link rel="apple-touch-icon" href="/icone-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Life Company" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/*
          O body do react-native-web não rola; quem rola são os ScrollView.
          Sem este reset a página ganha uma barra de rolagem extra.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
