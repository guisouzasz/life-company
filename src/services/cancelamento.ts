/**
 * Regras de prazo de cancelamento por período da aula (espelha o backend).
 *  - Manhã  (05:30–11:30): até 20:00 do dia anterior
 *  - Tarde  (13:00–17:00): até 10:00 do próprio dia
 *  - Noite  (18:00–22:00): até 14:00 do próprio dia
 *
 * São os prazos do Termo de Normas que o aluno aceita no primeiro acesso
 * (backend/src/termos/termo.ts, seção 2). Mudar aqui sem mudar lá — e sem
 * mudar o backend, que é quem decide — deixa o app prometendo um prazo que
 * a API não cumpre.
 */
import { formatDate } from './date';

export type Periodo = 'manha' | 'tarde' | 'noite';

export function periodoDaAula(horaInicio: string): Periodo {
  const [h, m] = horaInicio.split(':').map((n) => parseInt(n, 10));
  const min = h * 60 + m;
  if (min < 720) return 'manha';
  if (min < 1080) return 'tarde';
  return 'noite';
}

/** Data-limite (local) para cancelar. Usa só a parte YYYY-MM-DD para evitar fuso. */
export function limiteCancelamento(dataAula: string, horaInicio: string): Date {
  const [ano, mes, dia] = dataAula.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  const d = new Date(ano, mes - 1, dia);
  switch (periodoDaAula(horaInicio)) {
    case 'manha':
      d.setDate(d.getDate() - 1);
      d.setHours(20, 0, 0, 0);
      break;
    case 'tarde':
      d.setHours(10, 0, 0, 0);
      break;
    case 'noite':
      d.setHours(14, 0, 0, 0);
      break;
  }
  return d;
}

export function podeCancelar(dataAula: string, horaInicio: string, agora = new Date()): boolean {
  return agora.getTime() < limiteCancelamento(dataAula, horaInicio).getTime();
}

/** Texto amigável do prazo, ex.: "Cancele até 02/07 às 20:00". */
export function prazoLabel(dataAula: string, horaInicio: string): string {
  const d = limiteCancelamento(dataAula, horaInicio);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `Cancele até ${formatDate(iso, 'DD/MM')} às ${hora}`;
}
