/**
 * Helpers de data sem dependência externa (substitui dayjs)
 */

const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_LONGO = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS_CURTO  = ['dom','seg','ter','qua','qui','sex','sáb'];
const DIAS_LONGO  = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

const DIA_MAP: Record<number, string> = { 1:'SEGUNDA',2:'TERCA',3:'QUARTA',4:'QUINTA',5:'SEXTA' };

export function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

export function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const dow = isoWeekday(d);
  d.setDate(d.getDate() - (dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfIsoWeek(date: Date): Date {
  const d = startOfIsoWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatDate(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date + (date.includes('T') ? '' : 'T00:00:00')) : date;
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('DD', String(d.getDate()).padStart(2, '0'))
    .replace('HH', String(d.getHours()).padStart(2, '0'))
    .replace('mm', String(d.getMinutes()).padStart(2, '0'))
    .replace('ddd', DIAS_CURTO[d.getDay()])
    .replace('dddd', DIAS_LONGO[d.getDay()])
    .replace('MMM', MESES_CURTO[d.getMonth()])
    .replace('MMMM', MESES_LONGO[d.getMonth()]);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function diffHours(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 3600000;
}

export function getDiaSemanaKey(date: Date): string {
  return DIA_MAP[isoWeekday(date)] || '';
}

/** Retorna os próximos N dias úteis a partir de hoje */
export function getProximosDiasUteis(n = 10): Array<{
  data: string; diaNum: string; diaSemana: string; diaNome: string; mesNome: string;
}> {
  const dias = [];
  let d = new Date();
  while (dias.length < n) {
    const dow = isoWeekday(d);
    if (dow >= 1 && dow <= 5) {
      dias.push({
        data: formatDate(d, 'YYYY-MM-DD'),
        diaNum: formatDate(d, 'DD'),
        diaSemana: DIA_MAP[dow],
        diaNome: DIAS_CURTO[d.getDay()],
        mesNome: MESES_CURTO[d.getMonth()],
      });
    }
    d = addDays(d, 1);
  }
  return dias;
}

export function endOfIsoWeekFormatted(): string {
  return formatDate(endOfIsoWeek(new Date()), 'DD/MM/YYYY');
}

export function formatRelative(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DIAS_CURTO[d.getDay()]}, ${formatDate(d, 'DD/MM')}`;
}
