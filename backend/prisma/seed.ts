import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** O banco apontado é da própria máquina? */
function bancoLocal(): boolean {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(process.env.DATABASE_URL ?? '');
}

function abortar(motivo: string, comoResolver: string): never {
  console.error(`\n❌ ${motivo}\n   ${comoResolver}\n`);
  process.exit(1);
}

async function main() {
  // Este seed já criou em produção um admin com senha trivial. As duas travas
  // abaixo existem para isso não se repetir: rodar contra banco remoto passa a
  // exigir intenção explícita, e não há mais senha embutida no código.
  if (!bancoLocal() && process.env.SEED_FORCAR !== '1') {
    abortar(
      'DATABASE_URL não aponta para um banco local.',
      'Se é isso mesmo que você quer, rode de novo com SEED_FORCAR=1.',
    );
  }
  const senhaAdminPura = process.env.SEED_ADMIN_SENHA;
  if (!senhaAdminPura || senhaAdminPura.length < 8) {
    abortar(
      'Falta SEED_ADMIN_SENHA (mínimo de 8 caracteres) para a conta de administrador.',
      'Ex.: SEED_ADMIN_SENHA="uma-senha-forte" npm run prisma:seed',
    );
  }
  const emailAdmin = process.env.SEED_ADMIN_EMAIL || 'admin@studio.com';

  console.log('🌱 Iniciando seed...');

  // Admin
  const senhaAdmin = await bcrypt.hash(senhaAdminPura, 12);
  const admin = await prisma.usuario.upsert({
    where: { cpf: '00000000000' },
    // A senha é reescrita a cada execução: é assim que se troca a senha do
    // admin num banco que já existe, já que o app não tem essa tela.
    update: { senhaHash: senhaAdmin, email: emailAdmin },
    create: {
      nome: 'Administrador',
      cpf: '00000000000',
      email: emailAdmin,
      telefone: '41999999999',
      senhaHash: senhaAdmin,
      tipoUsuario: 'ADMIN',
      ativo: true,
    },
  });
  console.log('✅ Admin criado/atualizado:', admin.email);

  // Planos
  const planos = await Promise.all([
    prisma.plano.upsert({ where: { id: 'p1' }, update: {}, create: { id: 'p1', nome: '1x por semana', aulasSemanais: 1 } }),
    prisma.plano.upsert({ where: { id: 'p2' }, update: {}, create: { id: 'p2', nome: '2x por semana', aulasSemanais: 2 } }),
    prisma.plano.upsert({ where: { id: 'p3' }, update: {}, create: { id: 'p3', nome: '3x por semana', aulasSemanais: 3 } }),
    prisma.plano.upsert({ where: { id: 'p4' }, update: {}, create: { id: 'p4', nome: '4x por semana', aulasSemanais: 4 } }),
    prisma.plano.upsert({ where: { id: 'p5' }, update: {}, create: { id: 'p5', nome: '5x por semana', aulasSemanais: 5 } }),
  ]);
  console.log('✅ Planos criados:', planos.length);

  // Modalidades
  const modalidades = await Promise.all([
    prisma.modalidade.upsert({ where: { nome: 'Funcional' }, update: {}, create: { nome: 'Funcional' } }),
    prisma.modalidade.upsert({ where: { nome: 'Pilates' }, update: {}, create: { nome: 'Pilates' } }),
    prisma.modalidade.upsert({ where: { nome: 'Academia' }, update: {}, create: { nome: 'Academia' } }),
  ]);
  console.log('✅ Modalidades criadas:', modalidades.map(m => m.nome).join(', '));

  const funcional = modalidades.find(m => m.nome === 'Funcional')!;
  const pilates = modalidades.find(m => m.nome === 'Pilates')!;
  const academia = modalidades.find(m => m.nome === 'Academia')!;

  // Horários - Pilates
  const diasSemana = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'] as const;
  const horariosPilates = ['07:00', '08:00', '09:00', '10:00'];
  const horariosFuncional = ['06:00', '07:00', '18:00', '19:00'];
  const horariosAcademia = ['06:00', '07:00', '08:00', '09:00', '10:00', '17:00', '18:00', '19:00', '20:00'];

  for (const dia of diasSemana) {
    for (const hora of horariosPilates) {
      const [h, m] = hora.split(':');
      const horaFim = `${String(parseInt(h) + 1).padStart(2, '0')}:${m}`;
      await prisma.horario.upsert({
        where: { id: `pil-${dia}-${hora}` },
        update: {},
        create: { id: `pil-${dia}-${hora}`, modalidadeId: pilates.id, diaSemana: dia, horaInicio: hora, horaFim, capacidadeMaxima: 4 },
      });
    }
    for (const hora of horariosFuncional) {
      const [h, m] = hora.split(':');
      const horaFim = `${String(parseInt(h) + 1).padStart(2, '0')}:${m}`;
      await prisma.horario.upsert({
        where: { id: `fun-${dia}-${hora}` },
        update: {},
        create: { id: `fun-${dia}-${hora}`, modalidadeId: funcional.id, diaSemana: dia, horaInicio: hora, horaFim, capacidadeMaxima: 4 },
      });
    }
    for (const hora of horariosAcademia) {
      const [h, m] = hora.split(':');
      const horaFim = `${String(parseInt(h) + 1).padStart(2, '0')}:${m}`;
      await prisma.horario.upsert({
        where: { id: `aca-${dia}-${hora}` },
        update: {},
        create: { id: `aca-${dia}-${hora}`, modalidadeId: academia.id, diaSemana: dia, horaInicio: hora, horaFim, capacidadeMaxima: 4 },
      });
    }
  }
  console.log('✅ Horários criados');

  // Aluna de exemplo: só com SEED_EXEMPLO=1. Num banco de verdade ela seria
  // uma conta ativa com senha conhecida no meio dos alunos reais.
  if (process.env.SEED_EXEMPLO === '1') {
    const senhaAluno = await bcrypt.hash('aluno123', 12);
    const aluno = await prisma.usuario.upsert({
      where: { cpf: '12345678901' },
      update: {},
      create: {
        nome: 'Maria Silva',
        cpf: '12345678901',
        email: 'maria@email.com',
        telefone: '41988887777',
        senhaHash: senhaAluno,
        tipoUsuario: 'ALUNO',
        ativo: true,
      },
    });

    // Plano do aluno
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    await prisma.usuarioPlano.upsert({
      where: { id: 'up-maria' },
      update: {},
      create: {
        id: 'up-maria',
        usuarioId: aluno.id,
        planoId: 'p3',
        modalidadeId: pilates.id,
        vigenciaInicio: new Date('2024-01-01'),
        aulasUsadasSemana: 1,
        semanaReferencia: inicioSemana,
      },
    });
    console.log('✅ Aluna de exemplo criada:', aluno.email, '(senha aluno123)');
  }

  console.log('\n🎉 Seed concluído!');
  console.log(`\n📋 Admin → ${emailAdmin} / a senha passada em SEED_ADMIN_SENHA`);
  console.log('   Admin CPF → 000.000.000-00');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
