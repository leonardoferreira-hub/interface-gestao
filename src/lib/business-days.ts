/**
 * Calcula o Nº dia útil de um mês/ano.
 * Dias úteis = Seg-Sex (sem feriados por enquanto).
 * month é 0-indexed (0 = Janeiro).
 */
export function getNthBusinessDay(year: number, month: number, n: number): Date {
  let count = 0;
  const date = new Date(year, month, 1);

  while (count < n) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      count++;
      if (count === n) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return date;
}

/**
 * Formata mes_referencia como "2026-02-01" a partir de year e month (0-indexed).
 */
export function toMesReferencia(year: number, month: number): string {
  const m = String(month + 1).padStart(2, '0');
  return `${year}-${m}-01`;
}

/**
 * Formata uma data para o formato brasileiro dd/mm/yyyy.
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Retorna o label de um mês de referência. Ex: "fevereiro 2026"
 */
export function formatMesReferencia(mesRef: string): string {
  const [year, month] = mesRef.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
