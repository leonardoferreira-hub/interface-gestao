import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// --- Types ---

export interface Vinculo {
  id: string;
  coordenador_id: string;
  membro_id: string;
  criado_em: string;
  coordenador: { nome_completo: string; email: string } | null;
  membro: { nome_completo: string; email: string; role: string } | null;
}

export interface UsuarioSimples {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
}

// --- Queries ---

/** Todos os vínculos coordenador→analista com dados dos usuários */
export function useEquipeVinculos() {
  return useQuery({
    queryKey: ['equipe-vinculos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipe_vinculos')
        .select(`
          id,
          coordenador_id,
          membro_id,
          criado_em,
          coordenador:usuarios!coordenador_id(nome_completo, email),
          membro:usuarios!membro_id(nome_completo, email, role)
        `)
        .order('criado_em');
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        coordenador: Array.isArray(row.coordenador) ? row.coordenador[0] : row.coordenador,
        membro: Array.isArray(row.membro) ? row.membro[0] : row.membro,
      })) as Vinculo[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Coordenadores de gestão + RH (ativos) */
export function useCoordenadores() {
  return useQuery({
    queryKey: ['coordenadores-gestao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email, role')
        .in('role', ['coordenador_gestao', 'coordenador_rh'])
        .eq('ativo', true)
        .order('nome_completo');
      if (error) throw error;
      return (data || []) as UsuarioSimples[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todos os usuários ativos (para selects de adicionar) */
export function useUsuariosAtivos() {
  return useQuery({
    queryKey: ['usuarios-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email, role')
        .eq('ativo', true)
        .order('nome_completo');
      if (error) throw error;
      return (data || []) as UsuarioSimples[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// --- Mutations ---

export function useAddVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { coordenador_id: string; membro_id: string }) => {
      const { error } = await supabase
        .from('equipe_vinculos')
        .insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipe-vinculos'] });
      qc.invalidateQueries({ queryKey: ['equipe-gestao'] });
    },
  });
}

export function useRemoveVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipe_vinculos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipe-vinculos'] });
      qc.invalidateQueries({ queryKey: ['equipe-gestao'] });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('usuarios')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coordenadores-gestao'] });
      qc.invalidateQueries({ queryKey: ['usuarios-ativos'] });
      qc.invalidateQueries({ queryKey: ['equipe-vinculos'] });
      qc.invalidateQueries({ queryKey: ['equipe-gestao'] });
      qc.invalidateQueries({ queryKey: ['current-user'] });
    },
  });
}

/** Remove todos os vínculos de um coordenador (usado ao rebaixar) */
export function useRemoveVinculosCoordenador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coordenadorId: string) => {
      const { error } = await supabase
        .from('equipe_vinculos')
        .delete()
        .eq('coordenador_id', coordenadorId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipe-vinculos'] });
      qc.invalidateQueries({ queryKey: ['equipe-gestao'] });
    },
  });
}
