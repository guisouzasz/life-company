import './timezone'; // precisa vir antes de tudo — fixa o fuso do estúdio
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { garantirEsquema } from './prisma/garantir-esquema';
import { limparInativos } from './prisma/limpar-inativos';

/** Origens do app web autorizadas a chamar a API (CORS_ORIGINS separa por vírgula). */
const ORIGENS_PADRAO = [
  // Domínio próprio do estúdio (com e sem www — o navegador manda a origem
  // exata da barra de endereço, então as duas formas precisam constar).
  'https://www.academialifecompany.com.br',
  'https://academialifecompany.com.br',
  // Domínio da Vercel, que segue valendo como acesso alternativo.
  'https://life-company.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

function origensPermitidas(): string[] {
  const doAmbiente = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return doAmbiente.length > 0 ? doAmbiente : ORIGENS_PADRAO;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // O Swagger expõe o mapa completo da API, então fica DESLIGADO por padrão e
  // só sobe com SWAGGER_DOCS=1, na máquina de quem desenvolve. Antes dependia
  // de NODE_ENV — que o .env versionado declara como "development" e sobe
  // junto no deploy —, ou seja, a proteção não valia justamente em produção.
  const swaggerLigado = process.env.SWAGGER_DOCS === '1';

  // Railway/Vercel entregam a requisição por um proxy: sem isto todo mundo
  // chega com o mesmo req.ip e o rate limit contaria os alunos juntos.
  // O "1" confia só no último salto, que é o proxy da hospedagem.
  app.set('trust proxy', 1);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // O app nativo (iOS/Android) não manda header Origin — CORS não se aplica a
  // ele. A lista abaixo restringe apenas quem chama de dentro de um browser.
  const permitidas = origensPermitidas();
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || permitidas.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  if (swaggerLigado) {
    const config = new DocumentBuilder()
      .setTitle('Studio API')
      .setDescription('API completa para Studio de Atividade Física')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  // Alinha o banco ANTES de aceitar tráfego: enquanto isto não passa, quem
  // está usando o sistema continua atendido pela versão anterior do deploy.
  await garantirEsquema(app.get(PrismaService));

  /**
   * Devolve às turmas as vagas de alunos já desativados. Falha aqui não
   * derruba o boot: é arrumação de dados, e o estúdio funciona sem ela.
   */
  await limparInativos(app.get(PrismaService)).catch((e) =>
    console.error('não consegui limpar as turmas dos alunos inativos:', e?.message),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 Studio API rodando na porta ${port}`);
  console.log(`🔒 CORS liberado para: ${permitidas.join(', ')}`);
  console.log(
    swaggerLigado
      ? `📚 Swagger: http://localhost:${port}/api/docs\n`
      : '📚 Swagger desligado (defina SWAGGER_DOCS=1 para ligar)\n',
  );
}
bootstrap();
