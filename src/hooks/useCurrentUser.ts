import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSyncExternalStore } from 'react';

// Roles do sistema
export type UserRole =
  | 'coordenador_estruturacao'
  | 'analista_estruturacao'
  | 'coordenador_gestao'
  | 'analista_gestao'
  | 'coordenador_financeiro'
  | 'analista_contabil'
  | 'analista_financeiro'
  | 'coordenador_rh'
  | 'analista_rh'
  | 'comercial'
  | 'admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin (todas permissões)',
  coordenador_estruturacao: 'Coordenador Estruturação',
  analista_estruturacao: 'Analista Estruturação',
  coordenador_gestao: 'Coordenador Gestão',
  analista_gestao: 'Analista Gestão',
  coordenador_financeiro: 'Coordenador Financeiro',
  analista_contabil: 'Analista Contábil',
  analista_financeiro: 'Analista Financeiro',
  coordenador_rh: 'Coordenador RH',
  analista_rh: 'Analista RH',
  comercial: 'Comercial',
};

export interface CurrentUser {
  id: string;
  nome_completo: string;
  email: string;
  role: UserRole;
}

// Role override — admin can switch roles to preview different views
const OVERRIDE_KEY = 'role_override';
const overrideListeners = new Set<() => void>();

function getOverride(): UserRole | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(OVERRIDE_KEY) as UserRole) || null;
}

function setOverride(role: UserRole | null) {
  if (role) localStorage.setItem(OVERRIDE_KEY, role);
  else localStorage.removeItem(OVERRIDE_KEY);
  overrideListeners.forEach(fn => fn());
}

function subscribeOverride(fn: () => void) {
  overrideListeners.add(fn);
  return () => { overrideListeners.delete(fn); };
}

export function useRoleOverride() {
  const override = useSyncExternalStore(subscribeOverride, getOverride, () => null);
  return { roleOverride: override, setRoleOverride: setOverride };
}

// Hook principal — retorna o usuário logado via Google Auth
export function useCurrentUser() {
  const { user: authUser } = useAuth();

  return useQuery<CurrentUser | null>({
    queryKey: ['current-user', authUser?.id],
    queryFn: async () => {
      if (!authUser?.email) return null;

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_completo, email, role')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        nome_completo: (data as any).nome_completo || '',
        email: (data as any).email || '',
        role: ((data as any).role || 'analista_gestao') as UserRole,
      };
    },
    enabled: !!authUser?.email,
  });
}

// Permissões derivadas do role (respects override for admin)
export function usePermissions() {
  const { data: user } = useCurrentUser();
  const { roleOverride } = useRoleOverride();

  const realRole = user?.role || null;
  const isAdmin = realRole === 'admin';
  const effectiveRole = (isAdmin && roleOverride) ? roleOverride : realRole;

  const isCoordGestao = effectiveRole === 'coordenador_gestao';
  const isCoordRH = effectiveRole === 'coordenador_rh';

  return {
    user,
    realRole,
    role: effectiveRole,
    isAdmin,
    isCoordGestao,
    isCoordRH,
    isLoggedIn: !!user,
    canManageRotinas: isAdmin || isCoordGestao || isCoordRH,
  };
}
