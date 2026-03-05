import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UsuarioGestao {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
}

// Emails da equipe Gestão (coordenadores + membros)
const EQUIPE_GESTAO_EMAILS = [
  'rafael.barichello@grupotravessia.com',
  'yuri.inokuti@grupotravessia.com',
  'diego.bomfim@grupotravessia.com',
  'camila.oliveira@grupotravessia.com',
];

export function useEquipeGestao() {
  return useQuery({
    queryKey: ['equipe-gestao'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentEmail = user?.email || '';

      const emails = [...EQUIPE_GESTAO_EMAILS];
      if (currentEmail && !emails.includes(currentEmail)) {
        emails.push(currentEmail);
      }

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email, role')
        .eq('ativo', true)
        .in('email', emails)
        .order('nome_completo');

      if (error) throw error;
      return (data || []) as UsuarioGestao[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
