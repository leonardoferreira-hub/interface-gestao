import { useState, useMemo, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarCheck, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, Settings, Users,
  Plus, Trash2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageTransition, AnimatedCard } from '@/components/ui/animations';
import { motion } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useEquipeGestao } from '@/hooks/useEquipeGestao';
import {
  useRotinas, useCumprimentosMes, useUpdateRotina,
  useCreateRotina, useDeleteRotina,
  useUpsertCumprimentos, useMarcarCumprida,
  type Rotina, type RotinaCumprimento,
} from '@/hooks/useRotinas';
import {
  getNthBusinessDay, toMesReferencia, formatDateBR, formatMesReferencia,
} from '@/lib/business-days';

// ── Types ──

interface Usuario {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
}

interface RotinaView extends Rotina {
  cumprimento: RotinaCumprimento | null;
  dataEsperadaCalc: Date;
  isOverdue: boolean;
}

// ── Status helpers ──

const STATUS_CONFIG = {
  cumprida: { label: 'Cumprida', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  pendente: { label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-l-amber-500', dot: 'bg-amber-500' },
  atrasada: { label: 'Atrasada', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-l-red-500', dot: 'bg-red-500' },
} as const;

function getEffectiveStatus(cumprimento: RotinaCumprimento | null, dataEsperada: Date): keyof typeof STATUS_CONFIG {
  if (cumprimento?.status === 'cumprida') return 'cumprida';
  if (new Date() > dataEsperada) return 'atrasada';
  return 'pendente';
}

// ── Rotina Row ──

function RotinaRow({ rotina, usuarios, currentUserId, isAdmin, onMarcarCumprida }: {
  rotina: RotinaView;
  usuarios: Usuario[];
  currentUserId: string | null;
  isAdmin: boolean;
  onMarcarCumprida: (rotina: RotinaView) => void;
}) {
  const status = getEffectiveStatus(rotina.cumprimento, rotina.dataEsperadaCalc);
  const cfg = STATUS_CONFIG[status];
  const responsavel = usuarios.find(u => u.id === rotina.responsavel_id);
  const canMark = status !== 'cumprida' && (isAdmin || currentUserId === rotina.responsavel_id);

  return (
    <Card className={cn("border-l-[3px]", cfg.border)}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-medium", status === 'cumprida' && 'text-muted-foreground')}>
              {rotina.nome}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Prazo: {formatDateBR(rotina.dataEsperadaCalc)} ({rotina.dia_util_regra}º dia útil)
            </span>
            {responsavel && (
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center shrink-0 border border-primary/20">
                  {responsavel.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
                {responsavel.nome_completo.split(' ')[0]}
              </span>
            )}
            {!responsavel && (
              <span className="text-muted-foreground/50 italic">Sem responsável</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className={cn("text-[11px] border-0 gap-1", cfg.bg, cfg.color)}>
            {status === 'cumprida' && <CheckCircle2 className="h-3 w-3" />}
            {status === 'pendente' && <Clock className="h-3 w-3" />}
            {status === 'atrasada' && <AlertTriangle className="h-3 w-3" />}
            {cfg.label}
          </Badge>

          {rotina.cumprimento?.data_cumprimento && (
            <span className="text-xs text-muted-foreground">
              {formatDateBR(rotina.cumprimento.data_cumprimento.split('T')[0])}
            </span>
          )}

          {canMark && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onMarcarCumprida(rotina)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Cumprida
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Admin Config Dialog ──

function AdminConfigDialog({ open, onOpenChange, rotinas, usuarios, onSave, onCreate, onDelete }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rotinas: Rotina[];
  usuarios: Usuario[];
  onSave: (id: string, updates: { dia_util_regra?: number; responsavel_id?: string | null; nome?: string }) => void;
  onCreate: (nome: string) => void;
  onDelete: (id: string) => void;
}) {
  const [novaRotina, setNovaRotina] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const handleCreateRotina = () => {
    if (!novaRotina.trim()) return;
    onCreate(novaRotina.trim());
    setNovaRotina('');
  };

  const startEditName = (r: Rotina) => {
    setEditingNameId(r.id);
    setEditingNameValue(r.nome);
  };

  const saveName = (id: string) => {
    if (editingNameValue.trim() && editingNameValue.trim() !== '') {
      onSave(id, { nome: editingNameValue.trim() });
    }
    setEditingNameId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Rotinas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Criar nova rotina */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/10">
            <Input
              placeholder="Nome da nova rotina..."
              value={novaRotina}
              onChange={(e) => setNovaRotina(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRotina()}
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreateRotina} disabled={!novaRotina.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Criar
            </Button>
          </div>

          {/* Lista de rotinas */}
          {rotinas.map(r => (
            <div key={r.id} className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                {editingNameId === r.id ? (
                  <Input
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={() => saveName(r.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(r.id); if (e.key === 'Escape') setEditingNameId(null); }}
                    className="h-7 text-sm font-medium flex-1"
                    autoFocus
                  />
                ) : (
                  <p className="text-sm font-medium flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => startEditName(r)}>
                    {r.nome}
                    <Pencil className="h-3 w-3 inline ml-1.5 opacity-40" />
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive/60 hover:text-destructive shrink-0"
                  onClick={() => { if (window.confirm(`Remover "${r.nome}"?`)) onDelete(r.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="space-y-1 w-28">
                  <label className="text-xs text-muted-foreground">Dia útil</label>
                  <Select
                    value={String(r.dia_util_regra)}
                    onValueChange={(v) => onSave(r.id, { dia_util_regra: Number(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>{n}º dia útil</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs text-muted-foreground">Responsável</label>
                  <Select
                    value={r.responsavel_id || '_none'}
                    onValueChange={(v) => onSave(r.id, { responsavel_id: v === '_none' ? null : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {usuarios.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──

const Rotinas = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [configOpen, setConfigOpen] = useState(false);

  const mesReferencia = toMesReferencia(selectedYear, selectedMonth);

  const { data: rotinas, isLoading: loadingRotinas } = useRotinas();
  const { data: cumprimentos, isLoading: loadingCumprimentos } = useCumprimentosMes(mesReferencia);
  const { data: usuarios = [] } = useEquipeGestao();
  const updateRotina = useUpdateRotina();
  const createRotina = useCreateRotina();
  const deleteRotina = useDeleteRotina();
  const upsertCumprimentos = useUpsertCumprimentos();
  const marcarCumprida = useMarcarCumprida();

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const currentUserData = usuarios.find(u => u.id === currentUserId);
  const isAdmin = currentUserData?.role === 'admin' || currentUserData?.role === 'coordenador_gestao' || currentUserData?.role === 'coordenador_rh';

  // Auto-generate cumprimentos for the selected month
  useEffect(() => {
    if (!rotinas?.length || cumprimentos === undefined) return;

    const missing = rotinas.filter(
      r => !cumprimentos?.find(c => c.rotina_id === r.id)
    );

    if (missing.length === 0) return;

    const records = missing.map(r => {
      const expectedDate = getNthBusinessDay(selectedYear, selectedMonth, r.dia_util_regra);
      return {
        rotina_id: r.id,
        mes_referencia: mesReferencia,
        data_esperada: expectedDate.toISOString().split('T')[0],
        status: new Date() > expectedDate ? 'atrasada' : 'pendente',
      };
    });

    upsertCumprimentos.mutate(records);
  }, [rotinas, cumprimentos, mesReferencia]);

  // Merge rotinas + cumprimentos
  const rotinasView = useMemo<RotinaView[]>(() => {
    if (!rotinas) return [];
    return rotinas.map(r => {
      const dataEsperadaCalc = getNthBusinessDay(selectedYear, selectedMonth, r.dia_util_regra);
      const cumprimento = cumprimentos?.find(c => c.rotina_id === r.id) || null;
      const isOverdue = !cumprimento?.data_cumprimento && new Date() > dataEsperadaCalc;
      return { ...r, cumprimento, dataEsperadaCalc, isOverdue };
    });
  }, [rotinas, cumprimentos, selectedYear, selectedMonth]);

  // Stats
  const stats = useMemo(() => {
    const total = rotinasView.length;
    const cumpridas = rotinasView.filter(r => getEffectiveStatus(r.cumprimento, r.dataEsperadaCalc) === 'cumprida').length;
    const atrasadas = rotinasView.filter(r => getEffectiveStatus(r.cumprimento, r.dataEsperadaCalc) === 'atrasada').length;
    const pendentes = total - cumpridas - atrasadas;
    return { total, cumpridas, pendentes, atrasadas };
  }, [rotinasView]);

  // Month navigation
  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  };

  // Handlers
  const handleMarcarCumprida = (rotina: RotinaView) => {
    if (!rotina.cumprimento || !currentUserId) {
      toast.error('Cumprimento não encontrado');
      return;
    }
    marcarCumprida.mutate(
      { id: rotina.cumprimento.id, cumprida_por: currentUserId },
      {
        onSuccess: () => toast.success(`"${rotina.nome}" marcada como cumprida`),
        onError: () => toast.error('Erro ao marcar cumprida'),
      }
    );
  };

  const handleSaveConfig = (id: string, updates: { dia_util_regra?: number; responsavel_id?: string | null; nome?: string }) => {
    updateRotina.mutate({ id, ...updates }, {
      onSuccess: () => toast.success('Rotina atualizada'),
      onError: () => toast.error('Erro ao atualizar'),
    });
  };

  const handleCreateRotina = (nome: string) => {
    createRotina.mutate({ nome }, {
      onSuccess: () => toast.success(`Rotina "${nome}" criada`),
      onError: () => toast.error('Erro ao criar rotina'),
    });
  };

  const handleDeleteRotina = (id: string) => {
    deleteRotina.mutate(id, {
      onSuccess: () => toast.success('Rotina removida'),
      onError: () => toast.error('Erro ao remover rotina'),
    });
  };

  const isLoading = loadingRotinas || loadingCumprimentos;

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

  const STAT_CARDS = [
    { key: 'cumpridas', label: 'Cumpridas', value: stats.cumpridas, dot: 'bg-emerald-500' },
    { key: 'pendentes', label: 'Pendentes', value: stats.pendentes, dot: 'bg-amber-500' },
    { key: 'atrasadas', label: 'Atrasadas', value: stats.atrasadas, dot: 'bg-red-500' },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Navigation />

        {/* Hero */}
        <div className="relative overflow-hidden bg-[hsl(340,75%,12%)] text-white">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-rose-500/15 blur-3xl" />

          <div className="relative container py-5 sm:py-8 pb-6 sm:pb-10">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg shrink-0">
                  <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6 text-pink-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Cumprimento de Rotinas</h1>
                  <p className="text-white/50 text-xs sm:text-sm">
                    {stats.cumpridas}/{stats.total} cumpridas · {stats.atrasadas > 0 ? `${stats.atrasadas} atrasada${stats.atrasadas !== 1 ? 's' : ''}` : 'Nenhuma atrasada'}
                  </p>
                </div>
              </div>

              {/* Month navigation */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium capitalize min-w-[140px] text-center">
                  {formatMesReferencia(mesReferencia)}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* Mini stats */}
            <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
              {STAT_CARDS.map((s, i) => (
                <motion.div key={s.key} className="flex-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="rounded-lg bg-white/[0.05] border border-white/10 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider truncate">{s.label}</p>
                      <p className="text-base sm:text-lg font-bold tabular-nums">{s.value}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="container py-4 sm:py-6">
          {/* Admin config button */}
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setConfigOpen(true)}>
                <Settings className="h-3.5 w-3.5" />
                Configurar Rotinas
              </Button>
            </div>
          )}

          {/* Routines list */}
          <div className="space-y-3">
            {rotinasView.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarCheck className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma rotina cadastrada</p>
                <p className="text-xs mt-1">Configure as rotinas no painel de administração.</p>
              </div>
            )}
            {rotinasView.map((rotina, i) => (
              <AnimatedCard key={rotina.id} index={i}>
                <RotinaRow
                  rotina={rotina}
                  usuarios={usuarios}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onMarcarCumprida={handleMarcarCumprida}
                />
              </AnimatedCard>
            ))}
          </div>
        </main>
      </div>

      {/* Admin Config Dialog */}
      {isAdmin && rotinas && (
        <AdminConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          rotinas={rotinas}
          usuarios={usuarios}
          onSave={handleSaveConfig}
          onCreate={handleCreateRotina}
          onDelete={handleDeleteRotina}
        />
      )}
    </PageTransition>
  );
};

export default Rotinas;
