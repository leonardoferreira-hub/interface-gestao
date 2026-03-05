import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface Rotina {
  id: string;
  nome: string;
  descricao: string | null;
  dia_util_regra: number;
  responsavel_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface RotinaCumprimento {
  id: string;
  rotina_id: string;
  mes_referencia: string;
  data_esperada: string;
  data_cumprimento: string | null;
  cumprida_por: string | null;
  status: 'pendente' | 'cumprida' | 'atrasada';
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

// ── Queries ──

export function useRotinas() {
  return useQuery({
    queryKey: ['rotinas-gestao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotinas_gestao')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as Rotina[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCumprimentosMes(mesReferencia: string) {
  return useQuery({
    queryKey: ['rotina-gestao-cumprimentos', mesReferencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotina_gestao_cumprimentos')
        .select('*')
        .eq('mes_referencia', mesReferencia);
      if (error) throw error;
      return (data || []) as RotinaCumprimento[];
    },
    enabled: !!mesReferencia,
  });
}

// ── Mutations ──

export function useUpdateRotina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Rotina> & { id: string }) => {
      const { error } = await supabase
        .from('rotinas_gestao')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotinas-gestao'] });
    },
  });
}

export function useUpsertCumprimentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: {
      rotina_id: string;
      mes_referencia: string;
      data_esperada: string;
      status: string;
    }[]) => {
      const { error } = await supabase
        .from('rotina_gestao_cumprimentos')
        .upsert(records, { onConflict: 'rotina_id,mes_referencia', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        qc.invalidateQueries({ queryKey: ['rotina-gestao-cumprimentos', variables[0].mes_referencia] });
      }
    },
  });
}

export function useCreateRotina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; dia_util_regra?: number }) => {
      const { data, error } = await supabase
        .from('rotinas_gestao')
        .insert({ nome: input.nome, dia_util_regra: input.dia_util_regra || 5 })
        .select()
        .single();
      if (error) throw error;
      return data as Rotina;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotinas-gestao'] });
    },
  });
}

export function useDeleteRotina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rotinas_gestao')
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotinas-gestao'] });
    },
  });
}

export function useMarcarCumprida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cumprida_por }: { id: string; cumprida_por: string }) => {
      const { error } = await supabase
        .from('rotina_gestao_cumprimentos')
        .update({
          status: 'cumprida',
          data_cumprimento: new Date().toISOString(),
          cumprida_por,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rotina-gestao-cumprimentos'] });
    },
  });
}
