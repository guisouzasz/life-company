import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Admin
  const senhaAdmin = await bcrypt.hash('admin123', 12);
  const admin = await prisma.usuario.upsert({
    where: { cpf: '00000000000' },
    update: {},
    create: {
      nome: 'Administrador',
      cpf: '00000000000',
      email: 'admin@studio.com',
      telefone: '41999999999',
      senhaHash: senhaAdmin,
      tipoUsuario: 'ADMIN',
      ativo: true,
    },
  });
  console.log('✅ Admin criado:', admin.email);

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

  // Aluno de exemplo
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
  console.log('✅ Aluno exemplo criado:', aluno.email);
  console.log('\n🎉 Seed concluído!');
  console.log('\n📋 Credenciais:');
  console.log('  Admin → admin@studio.com / admin123');
  console.log('  Aluno → maria@email.com / aluno123');
  console.log('  Admin CPF → 000.000.000-00');
  console.log('  Aluno CPF → 123.456.789-01');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
