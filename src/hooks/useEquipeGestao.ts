import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UsuarioGestao {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
}

/**
 * Retorna a equipe de gestão dinamicamente:
 * - Coordenadores (role = coordenador_gestao ou coordenador_rh)
 * - Analistas vinculados via tabela equipe_vinculos
 * - O usuário logado (sempre incluído)
 */
export function useEquipeGestao() {
  return useQuery({
    queryKey: ['equipe-gestao'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // 1. Buscar coordenadores de gestão e RH
      const { data: coordenadores, error: errCoord } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email, role')
        .in('role', ['coordenador_gestao', 'coordenador_rh'])
        .eq('ativo', true);
      if (errCoord) throw errCoord;

      // 2. Buscar membros vinculados
      const { data: vinculos, error: errVinc } = await supabase
        .from('equipe_vinculos')
        .select('membro:usuarios!membro_id(id, nome_completo, email, role)');
      if (errVinc) throw errVinc;

      // 3. Montar set único
      const map = new Map<string, UsuarioGestao>();

      for (const c of (coordenadores || [])) {
        map.set(c.id, c as UsuarioGestao);
      }

      for (const v of (vinculos || [])) {
        const m = Array.isArray((v as any).membro) ? (v as any).membro[0] : (v as any).membro;
        if (m && !map.has(m.id)) {
          map.set(m.id, m as UsuarioGestao);
        }
      }

      // 4. Incluir o usuário logado se não estiver
      const currentEmail = user.email || '';
      const alreadyIn = Array.from(map.values()).some(u => u.email === currentEmail);
      if (!alreadyIn && currentEmail) {
        const { data: self } = await supabase
          .from('usuarios')
          .select('id, nome_completo, email, role')
          .eq('email', currentEmail)
          .maybeSingle();
        if (self) map.set(self.id, self as UsuarioGestao);
      }

      return Array.from(map.values()).sort((a, b) =>
        a.nome_completo.localeCompare(b.nome_completo)
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}
