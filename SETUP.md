# Studio App — Guia de Instalação e Execução

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

---

## 1. Backend (NestJS)

### Instalar dependências
```bash
cd backend
npm install
```

### Configurar banco de dados
1. Crie um banco PostgreSQL chamado `studio_db`
2. Copie o `.env.example` para `.env` e ajuste a URL:
```bash
cp .env.example .env
```
Edite o `.env`:
```
DATABASE_URL="postgresql://SEU_USER:SUA_SENHA@localhost:5432/studio_db"
```

### Rodar migrations e seed
```bash
npx prisma migrate dev --name init
npx ts-node -r tsconfig-paths/register prisma/seed.ts
```

### Iniciar o servidor
```bash
npm run start:dev
```

API disponível em: **http://localhost:3000**
Swagger em: **http://localhost:3000/api/docs**

---

## 2. App Mobile (Expo)

### Instalar dependências
```bash
# Volte para a raiz do projeto
cd ..
npm install
```

### Configurar URL da API

**Web (browser):** já está configurado como `localhost:3000`

**Android emulador:** o `10.0.2.2` já está configurado no arquivo `src/services/api.ts`

**Dispositivo físico:** edite `src/services/api.ts` e troque o IP pelo IP da sua máquina na rede local (ex: `192.168.1.100:3000`)

### Iniciar o app
```bash
# Web (mais fácil para testar)
npm run web

# Android
npm run android

# iOS
npm run ios
```

---

## Credenciais de teste

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin  | admin@studio.com | admin123 |
| Aluno  | maria@email.com | aluno123 |

---

## Estrutura do projeto

```
studio-app/
├── backend/                    ← API NestJS
│   ├── prisma/
│   │   ├── schema.prisma       ← Modelo do banco
│   │   └── seed.ts             ← Dados iniciais
│   └── src/
│       ├── auth/               ← Login, primeiro acesso, JWT
│       ├── usuarios/           ← CRUD de alunos
│       ├── planos/             ← Planos semanais
│       ├── modalidades/        ← Funcional, Pilates, Academia
│       ├── horarios/           ← Grade semanal de horários
│       ├── agendamentos/       ← Regras de negócio (8h, vagas, saldo)
│       ├── presencas/          ← Controle de presença
│       └── relatorios/         ← Dashboard e frequência
└── src/                        ← App Expo/React Native
    ├── app/
    │   ├── index.tsx            ← Login
    │   ├── dashboard.tsx        ← Dashboard do aluno
    │   ├── agendamento.tsx      ← Agendar aulas
    │   ├── historico.tsx        ← Histórico do aluno
    │   ├── primeiro-acesso.tsx  ← Ativar conta
    │   └── admin/
    │       ├── dashboard.tsx    ← Painel admin
    │       ├── alunos.tsx       ← Gestão de alunos
    │       ├── horarios.tsx     ← Gestão de horários
    │       ├── frequencia.tsx   ← Relatório de frequência
    │       └── novo-aluno.tsx   ← Cadastrar aluno
    ├── services/
    │   └── api.ts               ← Cliente HTTP
    └── store/
        └── auth.ts              ← Estado de autenticação (Zustand)
```

## Regras de negócio implementadas

- ✅ Máximo 4 alunos por horário
- ✅ Controle de saldo semanal com reset automático toda segunda
- ✅ Cancelamento bloqueado com menos de 8h de antecedência
- ✅ Validação de modalidade compatível com o plano do aluno
- ✅ Bloqueio de agendamento duplicado no mesmo horário/data
- ✅ Exibição de vagas disponíveis em tempo real
- ✅ Primeiro acesso com token único + validação por CPF
- ✅ JWT (15min) + Refresh Token rotativo (7 dias)
