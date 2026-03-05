import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Users, UserPlus, Loader2, X, Search, Shield, User, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition, AnimatedCard } from '@/components/ui/animations';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { usePermissions, useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useEquipeVinculos,
  useCoordenadores,
  useUsuariosAtivos,
  useAddVinculo,
  useRemoveVinculo,
  useUpdateUserRole,
  useRemoveVinculosCoordenador,
  type UsuarioSimples,
} from '@/hooks/useEquipeVinculos';

// ── Cores dos cards por índice ──
const CARD_BORDERS = [
  'border-l-emerald-500',
  'border-l-blue-500',
  'border-l-purple-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
];

const CARD_AVATARS = [
  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
  'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Stat Card (hero) ──
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: any; color: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.05] border border-white/10 p-3 flex items-center gap-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wider truncate">{label}</p>
        <p className="text-lg font-bold tabular-nums text-white">{value}</p>
      </div>
    </div>
  );
}

// ── Page ──
const Equipe = () => {
  const { isAdmin, isCoordGestao, isCoordRH, user } = usePermissions();
  const { data: currentUser } = useCurrentUser();
  const canAccess = isAdmin || isCoordGestao || isCoordRH;

  const { data: vinculos = [], isLoading: loadingVinculos } = useEquipeVinculos();
  const { data: coordenadores = [], isLoading: loadingCoord } = useCoordenadores();
  const { data: todosUsuarios = [] } = useUsuariosAtivos();

  const addVinculo = useAddVinculo();
  const removeVinculo = useRemoveVinculo();
  const updateRole = useUpdateUserRole();
  const removeVinculosCoord = useRemoveVinculosCoordenador();

  // Dialog states
  const [addAnalistaOpen, setAddAnalistaOpen] = useState(false);
  const [addAnalistaCoordId, setAddAnalistaCoordId] = useState<string | null>(null);
  const [addCoordOpen, setAddCoordOpen] = useState(false);
  const [removeCoordConfirm, setRemoveCoordConfirm] = useState<UsuarioSimples | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Agrupar vínculos por coordenador
  const grupos = useMemo(() => {
    return coordenadores
      .filter(c => {
        // Coordenador vê só o próprio grupo; admin vê todos
        if (isAdmin) return true;
        return c.id === currentUser?.id;
      })
      .map(coord => ({
        coordenador: coord,
        membros: vinculos
          .filter(v => v.coordenador_id === coord.id)
          .map(v => ({ vinculoId: v.id, ...v.membro! })),
      }));
  }, [coordenadores, vinculos, isAdmin, currentUser]);

  const totalAnalistas = useMemo(() => {
    const ids = new Set(vinculos.map(v => v.membro_id));
    return ids.size;
  }, [vinculos]);

  // Usuários disponíveis para vincular (não são o coordenador e não estão já vinculados a ele)
  const usuariosDisponiveis = useMemo(() => {
    if (!addAnalistaCoordId) return [];
    const jaVinculados = new Set(
      vinculos.filter(v => v.coordenador_id === addAnalistaCoordId).map(v => v.membro_id)
    );
    return todosUsuarios.filter(u =>
      u.id !== addAnalistaCoordId &&
      !jaVinculados.has(u.id) &&
      u.role === 'analista_gestao'
    );
  }, [todosUsuarios, vinculos, addAnalistaCoordId]);

  // Usuários disponíveis para promover a coordenador
  const usuariosParaCoordenador = useMemo(() => {
    const coordIds = new Set(coordenadores.map(c => c.id));
    return todosUsuarios.filter(u =>
      !coordIds.has(u.id) &&
      u.role !== 'admin'
    );
  }, [todosUsuarios, coordenadores]);

  // Handlers
  const handleAddAnalista = async (membroId: string) => {
    if (!addAnalistaCoordId) return;
    try {
      await addVinculo.mutateAsync({ coordenador_id: addAnalistaCoordId, membro_id: membroId });
      toast.success('Analista vinculado com sucesso');
    } catch {
      toast.error('Erro ao vincular analista');
    }
  };

  const handleRemoveVinculo = async (vinculoId: string) => {
    try {
      await removeVinculo.mutateAsync(vinculoId);
      toast.success('Vínculo removido');
    } catch {
      toast.error('Erro ao remover vínculo');
    }
  };

  const handleAddCoordenador = async (userId: string) => {
    try {
      await updateRole.mutateAsync({ userId, role: 'coordenador_gestao' });
      toast.success('Coordenador adicionado');
      setAddCoordOpen(false);
    } catch {
      toast.error('Erro ao promover coordenador');
    }
  };

  const handleRemoveCoordenador = async () => {
    if (!removeCoordConfirm) return;
    try {
      await removeVinculosCoord.mutateAsync(removeCoordConfirm.id);
      await updateRole.mutateAsync({ userId: removeCoordConfirm.id, role: 'analista_gestao' });
      toast.success('Coordenador removido');
      setRemoveCoordConfirm(null);
    } catch {
      toast.error('Erro ao remover coordenador');
    }
  };

  // Guard
  if (!canAccess) return <Navigate to="/" replace />;

  const isLoading = loadingVinculos || loadingCoord;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container py-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Navigation />

        {/* Hero */}
        <div className="relative overflow-hidden bg-[hsl(340,75%,12%)] text-white">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-rose-500/15 blur-3xl" />

          <div className="relative container py-5 sm:py-8 pb-6 sm:pb-10">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-pink-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Equipe — Gestão</h1>
                  <p className="text-white/50 text-xs sm:text-sm">
                    Gerencie coordenadores e analistas
                  </p>
                </div>
              </div>

              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => setAddCoordOpen(true)}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-1.5 self-start sm:self-auto"
                >
                  <Crown className="h-4 w-4" />
                  Adicionar Coordenador
                </Button>
              )}
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <StatCard label="Coordenadores" value={coordenadores.length} icon={Shield} color="bg-emerald-600" />
              <StatCard label="Analistas" value={totalAnalistas} icon={User} color="bg-blue-600" />
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="container py-6 space-y-4">
          {grupos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum coordenador encontrado.</p>
              {isAdmin && <p className="text-sm mt-1">Clique em "Adicionar Coordenador" para começar.</p>}
            </div>
          )}

          {grupos.map((grupo, idx) => (
            <AnimatedCard key={grupo.coordenador.id} index={idx}>
              <Card className={cn("border-l-[3px]", CARD_BORDERS[idx % CARD_BORDERS.length])}>
                <CardContent className="p-4 sm:p-5">
                  {/* Coordenador header */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border shrink-0",
                        CARD_AVATARS[idx % CARD_AVATARS.length]
                      )}>
                        {getInitials(grupo.coordenador.nome_completo)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{grupo.coordenador.nome_completo}</p>
                        <p className="text-xs text-muted-foreground truncate">{grupo.coordenador.email}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] gap-1">
                        <Shield className="h-3 w-3" />
                        {grupo.coordenador.role === 'coordenador_rh' ? 'Coord. RH' : 'Coord. Gestão'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setAddAnalistaCoordId(grupo.coordenador.id);
                          setSearchTerm('');
                          setAddAnalistaOpen(true);
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Analista</span>
                      </Button>

                      {isAdmin && grupo.coordenador.role !== 'coordenador_rh' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                          onClick={() => setRemoveCoordConfirm(grupo.coordenador)}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Analistas */}
                  {grupo.membros.length === 0 ? (
                    <p className="text-sm text-muted-foreground pl-[52px]">
                      Nenhum analista vinculado ainda.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pl-[52px]">
                      {grupo.membros.map(membro => (
                        <Badge
                          key={membro.vinculoId}
                          variant="secondary"
                          className="gap-1.5 py-1.5 px-3 text-sm"
                        >
                          <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center border border-primary/20">
                            {getInitials(membro.nome_completo)}
                          </span>
                          {membro.nome_completo.split(' ')[0]}
                          <button
                            onClick={() => handleRemoveVinculo(membro.vinculoId)}
                            className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remover vínculo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </AnimatedCard>
          ))}
        </main>

        {/* Dialog: Adicionar Analista */}
        <Dialog open={addAnalistaOpen} onOpenChange={setAddAnalistaOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Adicionar Analista</DialogTitle>
              <DialogDescription>
                Selecione um usuário para vincular ao coordenador.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[50vh]">
              {usuariosDisponiveis
                .filter(u => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return u.nome_completo.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                })
                .map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAddAnalista(u.id)}
                    disabled={addVinculo.isPending}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center border border-primary/20 shrink-0">
                      {getInitials(u.nome_completo)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.nome_completo}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                  </button>
                ))
              }
              {usuariosDisponiveis.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum usuário disponível para vincular.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Adicionar Coordenador (admin) */}
        <Dialog open={addCoordOpen} onOpenChange={setAddCoordOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Adicionar Coordenador</DialogTitle>
              <DialogDescription>
                O usuário selecionado terá seu role alterado para Coordenador de Gestão.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[50vh]">
              {usuariosParaCoordenador
                .filter(u => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return u.nome_completo.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                })
                .map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAddCoordenador(u.id)}
                    disabled={updateRole.isPending}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <span className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center border border-primary/20 shrink-0">
                      {getInitials(u.nome_completo)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.nome_completo}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                  </button>
                ))
              }
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Confirmar remoção de coordenador */}
        <Dialog open={!!removeCoordConfirm} onOpenChange={() => setRemoveCoordConfirm(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Remover coordenador?</DialogTitle>
              <DialogDescription>
                {removeCoordConfirm?.nome_completo} será rebaixado para Analista de Gestão e todos os vínculos serão removidos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRemoveCoordConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveCoordenador}
                disabled={updateRole.isPending || removeVinculosCoord.isPending}
              >
                {updateRole.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Remover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
};

export default Equipe;
