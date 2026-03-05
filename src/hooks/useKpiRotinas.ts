import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

interface CumprimentoRow {
  id: string;
  rotina_id: string;
  data_esperada: string;
  data_cumprimento: string | null;
  cumprida_por: string | null;
  status: 'pendente' | 'cumprida' | 'atrasada';
  mes_referencia: string;
  rotina: { nome: string }[] | { nome: string } | null;
  analista: { nome_completo: string }[] | { nome_completo: string } | null;
}

export interface KpiRotinasResult {
  totalCumprimentos: number;
  taxaEmDia: number;
  taxaAtrasada: number;
  taxaAntecipada: number;
  atrasoMedioDias: number;
  antecipacaoMediaDias: number;

  porRotina: Array<{
    rotinaId: string;
    rotinaNome: string;
    total: number;
    emDia: number;
    atrasadas: number;
    atrasoMedioDias: number;
  }>;

  porAnalista: Array<{
    analistaId: string;
    analistaNome: string;
    total: number;
    emDia: number;
    atrasoMedioDias: number;
  }>;

  evolucaoMensal: Array<{
    mes: string;
    mesLabel: string;
    taxaEmDia: number;
    taxaAtrasada: number;
    total: number;
  }>;

  pendentesAtrasadas: number;
}

// ── Helpers ──

const MES_LABELS: Record<string, string> = {
  '01': 'jan', '02': 'fev', '03': 'mar', '04': 'abr',
  '05': 'mai', '06': 'jun', '07': 'jul', '08': 'ago',
  '09': 'set', '10': 'out', '11': 'nov', '12': 'dez',
};

function extractDatePart(timestamptz: string): string {
  return timestamptz.slice(0, 10);
}

function diffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatMesLabel(mesRef: string): string {
  const [year, month] = mesRef.split('-');
  const label = MES_LABELS[month] || month;
  const shortYear = year.slice(2);
  return `${label}/${shortYear}`;
}

function buildDateRange(mesesAtras: number): { start: string; end: string } {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - mesesAtras, 1);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

// ── Hook ──

export function useKpiRotinas(mesesAtras = 6, analistaId?: string | null) {
  return useQuery({
    queryKey: ['kpi-rotinas-gestao', mesesAtras, analistaId || 'all'],
    queryFn: async () => {
      const { start, end } = buildDateRange(mesesAtras);

      // Fetch completed cumprimentos
      let qCumpridas = supabase
        .from('rotina_gestao_cumprimentos')
        .select('id, rotina_id, data_esperada, data_cumprimento, cumprida_por, status, mes_referencia, rotina:rotinas_gestao(nome), analista:usuarios!cumprida_por(nome_completo)')
        .eq('status', 'cumprida')
        .gte('data_esperada', start)
        .lte('data_esperada', end)
        .order('data_esperada', { ascending: true });

      if (analistaId) {
        qCumpridas = qCumpridas.eq('cumprida_por', analistaId);
      }

      const { data: cumpridas, error: errCumpridas } = await qCumpridas;
      if (errCumpridas) throw errCumpridas;

      // Fetch pending overdue ones
      let qAtrasadas = supabase
        .from('rotina_gestao_cumprimentos')
        .select('id')
        .eq('status', 'atrasada')
        .is('data_cumprimento', null)
        .gte('data_esperada', start)
        .lte('data_esperada', end);

      const { data: atrasadasPendentes, error: errAtrasadas } = await qAtrasadas;
      if (errAtrasadas) throw errAtrasadas;

      const rows = (cumpridas || []) as CumprimentoRow[];
      const pendentesAtrasadas = (atrasadasPendentes || []).length;

      return calcularKpis(rows, pendentesAtrasadas);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Calculation ──

function calcularKpis(rows: CumprimentoRow[], pendentesAtrasadas: number): KpiRotinasResult {
  const totalCumprimentos = rows.length;

  if (totalCumprimentos === 0) {
    return {
      totalCumprimentos: 0,
      taxaEmDia: 0,
      taxaAtrasada: 0,
      taxaAntecipada: 0,
      atrasoMedioDias: 0,
      antecipacaoMediaDias: 0,
      porRotina: [],
      porAnalista: [],
      evolucaoMensal: [],
      pendentesAtrasadas,
    };
  }

  let emDiaCount = 0;
  let atrasadaCount = 0;
  let antecipadaCount = 0;
  let somaAtraso = 0;
  let somaAntecipacao = 0;

  const rotinaMap = new Map<string, {
    nome: string;
    total: number;
    emDia: number;
    atrasadas: number;
    somaAtraso: number;
    countAtraso: number;
  }>();

  const analistaMap = new Map<string, {
    nome: string;
    total: number;
    emDia: number;
    somaAtraso: number;
    countAtraso: number;
  }>();

  const mesMap = new Map<string, {
    emDia: number;
    atrasada: number;
    total: number;
  }>();

  for (const row of rows) {
    if (!row.data_cumprimento) continue;

    const cumprimentoDate = extractDatePart(row.data_cumprimento);
    const esperadaDate = row.data_esperada;
    const diff = diffDays(cumprimentoDate, esperadaDate);

    const isEmDia = diff <= 0;
    const isAtrasada = diff > 0;
    const isAntecipada = diff < 0;

    if (isEmDia) emDiaCount++;
    if (isAtrasada) {
      atrasadaCount++;
      somaAtraso += diff;
    }
    if (isAntecipada) {
      antecipadaCount++;
      somaAntecipacao += Math.abs(diff);
    }

    // Per rotina
    const rotinaId = row.rotina_id;
    const rotinaObj = Array.isArray(row.rotina) ? row.rotina[0] : row.rotina;
    const rotinaNome = rotinaObj?.nome || 'Desconhecida';
    if (!rotinaMap.has(rotinaId)) {
      rotinaMap.set(rotinaId, { nome: rotinaNome, total: 0, emDia: 0, atrasadas: 0, somaAtraso: 0, countAtraso: 0 });
    }
    const r = rotinaMap.get(rotinaId)!;
    r.total++;
    if (isEmDia) r.emDia++;
    if (isAtrasada) {
      r.atrasadas++;
      r.somaAtraso += diff;
      r.countAtraso++;
    }

    // Per analista
    const analistaId = row.cumprida_por || 'desconhecido';
    const analistaObj = Array.isArray(row.analista) ? row.analista[0] : row.analista;
    const analistaNome = analistaObj?.nome_completo || 'Desconhecido';
    if (!analistaMap.has(analistaId)) {
      analistaMap.set(analistaId, { nome: analistaNome, total: 0, emDia: 0, somaAtraso: 0, countAtraso: 0 });
    }
    const a = analistaMap.get(analistaId)!;
    a.total++;
    if (isEmDia) a.emDia++;
    if (isAtrasada) {
      a.somaAtraso += diff;
      a.countAtraso++;
    }

    // Per month
    const mes = row.mes_referencia;
    if (!mesMap.has(mes)) {
      mesMap.set(mes, { emDia: 0, atrasada: 0, total: 0 });
    }
    const m = mesMap.get(mes)!;
    m.total++;
    if (isEmDia) m.emDia++;
    if (isAtrasada) m.atrasada++;
  }

  const taxaEmDia = (emDiaCount / totalCumprimentos) * 100;
  const taxaAtrasada = (atrasadaCount / totalCumprimentos) * 100;
  const taxaAntecipada = (antecipadaCount / totalCumprimentos) * 100;
  const atrasoMedioDias = atrasadaCount > 0 ? somaAtraso / atrasadaCount : 0;
  const antecipacaoMediaDias = antecipadaCount > 0 ? somaAntecipacao / antecipadaCount : 0;

  const porRotina = Array.from(rotinaMap.entries()).map(([rotinaId, v]) => ({
    rotinaId,
    rotinaNome: v.nome,
    total: v.total,
    emDia: v.emDia,
    atrasadas: v.atrasadas,
    atrasoMedioDias: v.countAtraso > 0 ? v.somaAtraso / v.countAtraso : 0,
  }));

  const porAnalista = Array.from(analistaMap.entries()).map(([analistaId, v]) => ({
    analistaId,
    analistaNome: v.nome,
    total: v.total,
    emDia: v.emDia,
    atrasoMedioDias: v.countAtraso > 0 ? v.somaAtraso / v.countAtraso : 0,
  }));

  const evolucaoMensal = Array.from(mesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      mesLabel: formatMesLabel(mes),
      taxaEmDia: v.total > 0 ? (v.emDia / v.total) * 100 : 0,
      taxaAtrasada: v.total > 0 ? (v.atrasada / v.total) * 100 : 0,
      total: v.total,
    }));

  return {
    totalCumprimentos,
    taxaEmDia,
    taxaAtrasada,
    taxaAntecipada,
    atrasoMedioDias,
    antecipacaoMediaDias,
    porRotina,
    porAnalista,
    evolucaoMensal,
    pendentesAtrasadas,
  };
}
