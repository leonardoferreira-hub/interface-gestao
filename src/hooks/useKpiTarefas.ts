import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

type TarefaStatus = 'todo' | 'doing' | 'validating' | 'done';

interface StatusLogRow {
  id: string;
  tarefa_id: string;
  status_novo: string;
  transicao_em: string;
}

interface TarefaRow {
  id: string;
  status: TarefaStatus;
  user_id: string;
}

export interface KpiTarefasResult {
  tempoMedioPorColuna: {
    todo: number;
    doing: number;
    validating: number;
  };

  leadTimeMedio: number;

  distribuicaoAtual: {
    todo: number;
    doing: number;
    validating: number;
    done: number;
  };

  totalTarefas: number;
  tarefasConcluidas: number;
}

// ── Hook ──

export function useKpiTarefas(analistaId?: string | null) {
  return useQuery({
    queryKey: ['kpi-tarefas-gestao', analistaId || 'all'],
    queryFn: async () => {
      // Fetch current tarefas (optionally filtered by user_id)
      let qTarefas = supabase
        .from('tarefas_gestao')
        .select('id, status, user_id');

      if (analistaId) {
        qTarefas = qTarefas.eq('user_id', analistaId);
      }

      const { data: tarefas, error: errTarefas } = await qTarefas;
      if (errTarefas) throw errTarefas;

      const tarefaRows = (tarefas || []) as TarefaRow[];
      const tarefaIds = tarefaRows.map(t => t.id);

      // If filtering by analyst and no tarefas, return empty
      if (analistaId && tarefaIds.length === 0) {
        return calcularKpis([], []);
      }

      // Fetch status logs
      let qLogs = supabase
        .from('tarefa_gestao_status_log')
        .select('id, tarefa_id, status_novo, transicao_em')
        .order('tarefa_id', { ascending: true })
        .order('transicao_em', { ascending: true });

      if (analistaId && tarefaIds.length > 0) {
        qLogs = qLogs.in('tarefa_id', tarefaIds);
      }

      const { data: logs, error: errLogs } = await qLogs;
      if (errLogs) throw errLogs;

      return calcularKpis(
        (logs || []) as StatusLogRow[],
        tarefaRows,
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Calculation ──

function calcularKpis(logs: StatusLogRow[], tarefas: TarefaRow[]): KpiTarefasResult {
  // Group logs by tarefa_id
  const logsByTarefa = new Map<string, StatusLogRow[]>();
  for (const log of logs) {
    if (!logsByTarefa.has(log.tarefa_id)) {
      logsByTarefa.set(log.tarefa_id, []);
    }
    logsByTarefa.get(log.tarefa_id)!.push(log);
  }

  const columnHours: Record<string, number> = { todo: 0, doing: 0, validating: 0 };
  const columnCount: Record<string, number> = { todo: 0, doing: 0, validating: 0 };

  const leadTimes: number[] = [];
  const now = new Date();

  for (const [, tarefaLogs] of logsByTarefa) {
    const trackedColumns = new Set<string>();

    for (let i = 0; i < tarefaLogs.length; i++) {
      const status = tarefaLogs[i].status_novo;
      const start = new Date(tarefaLogs[i].transicao_em);
      const end = i + 1 < tarefaLogs.length
        ? new Date(tarefaLogs[i + 1].transicao_em)
        : now;

      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      if (status in columnHours) {
        columnHours[status] += durationHours;
        trackedColumns.add(status);
      }
    }

    for (const col of trackedColumns) {
      columnCount[col]++;
    }

    const firstLog = tarefaLogs[0];
    const doneLog = tarefaLogs.find(l => l.status_novo === 'done');
    if (firstLog && doneLog) {
      const firstTime = new Date(firstLog.transicao_em);
      const doneTime = new Date(doneLog.transicao_em);
      const leadDays = (doneTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60 * 24);
      leadTimes.push(leadDays);
    }
  }

  const tempoMedioPorColuna = {
    todo: columnCount.todo > 0 ? columnHours.todo / columnCount.todo : 0,
    doing: columnCount.doing > 0 ? columnHours.doing / columnCount.doing : 0,
    validating: columnCount.validating > 0 ? columnHours.validating / columnCount.validating : 0,
  };

  const leadTimeMedio = leadTimes.length > 0
    ? leadTimes.reduce((sum, v) => sum + v, 0) / leadTimes.length
    : 0;

  const distribuicaoAtual = { todo: 0, doing: 0, validating: 0, done: 0 };
  for (const tarefa of tarefas) {
    if (tarefa.status in distribuicaoAtual) {
      distribuicaoAtual[tarefa.status as keyof typeof distribuicaoAtual]++;
    }
  }

  return {
    tempoMedioPorColuna,
    leadTimeMedio,
    distribuicaoAtual,
    totalTarefas: tarefas.length,
    tarefasConcluidas: distribuicaoAtual.done,
  };
}
