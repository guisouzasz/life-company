import './timezone'; // precisa vir antes de tudo — fixa o fuso do estúdio
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/** Origens do app web autorizadas a chamar a API (CORS_ORIGINS separa por vírgula). */
const ORIGENS_PADRAO = [
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
  const producao = process.env.NODE_ENV === 'production';

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

  // Swagger fica fora do ar em produção: expõe o mapa completo da API.
  if (!producao) {
    const config = new DocumentBuilder()
      .setTitle('Studio API')
      .setDescription('API completa para Studio de Atividade Física')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🚀 Studio API rodando na porta ${port}`);
  console.log(`🔒 CORS liberado para: ${permitidas.join(', ')}`);
  console.log(producao ? '📚 Swagger desabilitado (produção)\n' : `📚 Swagger: http://localhost:${port}/api/docs\n`);
}
bootstrap();
