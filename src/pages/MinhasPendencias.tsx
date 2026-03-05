import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Loader2, Trash2, ListTodo,
  CheckCircle2, Circle, PlayCircle, SearchCheck, Pencil,
  AlertTriangle, ArrowUp, ArrowDown, Minus,
  Users, X, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useEquipeGestao } from '@/hooks/useEquipeGestao';
import { PageTransition, AnimatedCard } from '@/components/ui/animations';
import { motion } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

// ──── Types ────
type TarefaStatus = 'todo' | 'validating' | 'doing' | 'done';
type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';

interface Tarefa {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  posicao: number;
  prioridade: Prioridade;
  id_emissao: string | null;
  mencionados: string[];
  criado_em: string;
  atualizado_em: string;
}

interface Usuario {
  id: string;
  nome_completo: string;
  email: string;
  role: string;
}

// ──── Config ────
const COLUMNS: { key: TarefaStatus; label: string; icon: any; color: string; bgHeader: string; borderColor: string; dotColor: string }[] = [
  { key: 'todo', label: 'A Fazer', icon: Circle, color: 'text-amber-500', bgHeader: 'bg-amber-500/10 border-amber-500/30', borderColor: 'border-l-amber-500', dotColor: 'bg-amber-500' },
  { key: 'doing', label: 'Em Andamento', icon: PlayCircle, color: 'text-blue-500', bgHeader: 'bg-blue-500/10 border-blue-500/30', borderColor: 'border-l-blue-500', dotColor: 'bg-blue-500' },
  { key: 'validating', label: 'Em Validação', icon: SearchCheck, color: 'text-purple-500', bgHeader: 'bg-purple-500/10 border-purple-500/30', borderColor: 'border-l-purple-500', dotColor: 'bg-purple-500' },
  { key: 'done', label: 'Concluído', icon: CheckCircle2, color: 'text-emerald-500', bgHeader: 'bg-emerald-500/10 border-emerald-500/30', borderColor: 'border-l-emerald-500', dotColor: 'bg-emerald-500' },
];

const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; icon: any; color: string; badge: string }> = {
  urgente: { label: 'Urgente', icon: AlertTriangle, color: 'text-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  alta: { label: 'Alta', icon: ArrowUp, color: 'text-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  media: { label: 'Média', icon: Minus, color: 'text-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  baixa: { label: 'Baixa', icon: ArrowDown, color: 'text-sky-400', badge: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300' },
};

// ──── Hooks ────

function useTarefas() {
  return useQuery({
    queryKey: ['tarefas-gestao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarefas_gestao')
        .select('*')
        .order('posicao', { ascending: true })
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as Tarefa[];
    },
  });
}

function useCreateTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { titulo: string; descricao?: string; status: TarefaStatus; prioridade: Prioridade; mencionados?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('tarefas_gestao')
        .insert({ ...input, user_id: user.id, mencionados: input.mencionados || [] })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas-gestao'] }),
  });
}

function useUpdateTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tarefa> & { id: string }) => {
      const { error } = await supabase
        .from('tarefas_gestao')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas-gestao'] }),
  });
}

function useDeleteTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tarefas_gestao')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas-gestao'] }),
  });
}

// ──── User Picker ────
function UserPicker({ selected, onChange, usuarios }: { selected: string[]; onChange: (ids: string[]) => void; usuarios: Usuario[] }) {
  const [search, setSearch] = useState('');
  const filtered = usuarios.filter(u =>
    !selected.includes(u.id) &&
    (u.nome_completo.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );
  const selectedUsers = usuarios.filter(u => selected.includes(u.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedUsers.map(u => (
          <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
            <span className="h-4 w-4 rounded-full bg-pink-500/20 text-pink-600 text-[9px] font-bold flex items-center justify-center shrink-0">
              {u.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
            {u.nome_completo.split(' ')[0]}
            <button onClick={() => onChange(selected.filter(id => id !== u.id))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            <Users className="h-3 w-3" /> Mencionar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum usuário</p>
            ) : filtered.map(u => (
              <button
                key={u.id}
                className="flex items-center gap-2 w-full p-1.5 rounded text-left hover:bg-muted transition-colors"
                onClick={() => { onChange([...selected, u.id]); setSearch(''); }}
              >
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {u.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{u.nome_completo}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.role.replace(/_/g, ' ')}</p>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ──── Kanban Card ────
function KanbanCard({ tarefa, usuarios, onEdit, onDelete, isDragging }: {
  tarefa: Tarefa;
  usuarios: Usuario[];
  onEdit: () => void;
  onDelete: () => void;
  isDragging: boolean;
}) {
  const prio = PRIORIDADE_CONFIG[tarefa.prioridade];
  const PrioIcon = prio.icon;
  const owner = usuarios.find(u => u.id === tarefa.user_id);
  const mentioned = usuarios.filter(u => tarefa.mencionados?.includes(u.id));
  const age = Math.floor((Date.now() - new Date(tarefa.criado_em).getTime()) / 86400000);

  return (
    <Card
      className={cn(
        "group border-l-[3px] cursor-grab active:cursor-grabbing transition-shadow duration-150",
        COLUMNS.find(c => c.key === tarefa.status)?.borderColor,
        'hover:shadow-md active:shadow-lg active:opacity-80',
        tarefa.status === 'done' && 'opacity-70'
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', tarefa.id);
        e.dataTransfer.effectAllowed = 'move';
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '0.4';
        requestAnimationFrame(() => { el.style.opacity = ''; });
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '';
      }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium leading-snug", tarefa.status === 'done' && 'line-through text-muted-foreground')}>
              {tarefa.titulo}
            </p>
          </div>
          <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>

        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
        )}

        {owner && (
          <div className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center shrink-0 border border-primary/20">
              {owner.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
            <span className="text-[10px] text-muted-foreground">{owner.nome_completo.split(' ')[0]}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] gap-0.5 border-0", prio.badge)}>
              <PrioIcon className="h-2.5 w-2.5" />
              {prio.label}
            </Badge>
            {age > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {age}d
              </span>
            )}
          </div>

          {mentioned.length > 0 && (
            <div className="flex -space-x-1.5">
              {mentioned.slice(0, 3).map(u => (
                <span
                  key={u.id}
                  title={u.nome_completo}
                  className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center border-2 border-background"
                >
                  {u.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              ))}
              {mentioned.length > 3 && (
                <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[8px] font-bold flex items-center justify-center border-2 border-background">
                  +{mentioned.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ──── Kanban Column ────
function KanbanColumn({ column, tarefas, usuarios, onAdd, onMove, onDelete, onEdit }: {
  column: typeof COLUMNS[number];
  tarefas: Tarefa[];
  usuarios: Usuario[];
  onAdd: () => void;
  onMove: (id: string, status: TarefaStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (tarefa: Tarefa) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const tarefaId = e.dataTransfer.getData('text/plain');
    if (tarefaId) onMove(tarefaId, column.key);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="flex flex-col min-w-[300px] sm:min-w-0">
      <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-t-xl border", column.bgHeader)}>
        <div className="flex items-center gap-2">
          <div className={cn("h-2 w-2 rounded-full", column.dotColor)} />
          <span className="text-sm font-semibold">{column.label}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">{tarefas.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div
        className={cn(
          "flex-1 space-y-2 p-2 rounded-b-xl border border-t-0 min-h-[250px] transition-all duration-200",
          dragOver ? 'bg-primary/[0.06] border-primary/30 shadow-inner' : 'bg-muted/20'
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tarefas.map(t => (
          <div key={t.id} className="transition-all duration-200">
            <KanbanCard
              tarefa={t}
              usuarios={usuarios}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t.id)}
              isDragging={false}
            />
          </div>
        ))}
        {tarefas.length === 0 && (
          <div className={cn(
            "flex flex-col items-center justify-center h-32 rounded-lg border border-dashed transition-all duration-200",
            dragOver ? 'border-primary/40 bg-primary/[0.06] text-primary' : 'border-border text-muted-foreground'
          )}>
            <p className="text-xs font-medium">{dragOver ? 'Solte aqui' : 'Nenhuma tarefa'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──── Filter Tabs ────
type ViewFilter = 'meu_board' | 'por_pessoa';

// ──── Page ────
const MinhasPendencias = () => {
  const { data: tarefas, isLoading } = useTarefas();
  const { data: usuarios = [] } = useEquipeGestao();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const deleteTarefa = useDeleteTarefa();

  const [viewFilter, setViewFilter] = useState<ViewFilter>('meu_board');
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<TarefaStatus>('todo');
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [mencionados, setMencionados] = useState<string[]>([]);

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Check if current user is admin/coordinator
  const currentUserData = usuarios.find(u => u.id === currentUserId);
  const isLeader = currentUserData?.role === 'admin' || currentUserData?.role === 'coordenador_gestao' || currentUserData?.role === 'coordenador_rh';

  const filteredTarefas = useMemo(() => {
    if (!tarefas || !currentUserId) return [];
    switch (viewFilter) {
      case 'meu_board':
        return tarefas.filter(t => t.user_id === currentUserId || t.mencionados?.includes(currentUserId));
      case 'por_pessoa':
        if (!viewUserId) return tarefas;
        return tarefas.filter(t => t.user_id === viewUserId || t.mencionados?.includes(viewUserId));
    }
  }, [tarefas, viewFilter, currentUserId, viewUserId]);

  const grouped = useMemo(() => {
    const map: Record<TarefaStatus, Tarefa[]> = { todo: [], validating: [], doing: [], done: [] };
    filteredTarefas.forEach(t => map[t.status]?.push(t));
    const prioOrder: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    Object.values(map).forEach(arr => arr.sort((a, b) => prioOrder[a.prioridade] - prioOrder[b.prioridade]));
    return map;
  }, [filteredTarefas]);

  const stats = useMemo(() => ({
    total: filteredTarefas.length,
    todo: grouped.todo.length,
    validating: grouped.validating.length,
    doing: grouped.doing.length,
    done: grouped.done.length,
  }), [filteredTarefas, grouped]);

  const openNewDialog = (status: TarefaStatus) => {
    setEditingTarefa(null);
    setTitulo('');
    setDescricao('');
    setPrioridade('media');
    setMencionados([]);
    setDialogStatus(status);
    setDialogOpen(true);
  };

  const openEditDialog = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao || '');
    setPrioridade(tarefa.prioridade);
    setMencionados(tarefa.mencionados || []);
    setDialogStatus(tarefa.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titulo.trim()) return toast.error('Título obrigatório');
    try {
      if (editingTarefa) {
        await updateTarefa.mutateAsync({
          id: editingTarefa.id,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prioridade,
          mencionados,
        });
        toast.success('Tarefa atualizada');
      } else {
        await createTarefa.mutateAsync({
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          status: dialogStatus,
          prioridade,
          mencionados,
        });
        toast.success('Tarefa criada');
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const handleMove = useCallback((id: string, status: TarefaStatus) => {
    updateTarefa.mutate({ id, status }, {
      onError: () => toast.error('Erro ao mover tarefa'),
    });
  }, [updateTarefa]);

  const handleDelete = (id: string) => {
    if (!window.confirm('Remover esta tarefa?')) return;
    deleteTarefa.mutate(id, {
      onSuccess: () => toast.success('Tarefa removida'),
      onError: () => toast.error('Erro ao remover'),
    });
  };

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
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg shrink-0">
                  <ListTodo className="h-5 w-5 sm:h-6 sm:w-6 text-pink-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Minhas Pendências</h1>
                  <p className="text-white/50 text-xs sm:text-sm">
                    {stats.total} tarefa{stats.total !== 1 ? 's' : ''} · {stats.doing} em andamento · {stats.done} concluída{stats.done !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                  <button
                    onClick={() => setViewFilter('meu_board')}
                    className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all", viewFilter === 'meu_board' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70')}
                  >
                    Meu Board
                  </button>
                  {isLeader && (
                    <button
                      onClick={() => { setViewFilter('por_pessoa'); setViewUserId(null); }}
                      className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all", viewFilter === 'por_pessoa' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70')}
                    >
                      Visão do Time
                    </button>
                  )}
                </div>
                {viewFilter === 'por_pessoa' && isLeader && (
                  <select
                    value={viewUserId || ''}
                    onChange={(e) => setViewUserId(e.target.value || null)}
                    className="h-7 rounded-md bg-white/10 border border-white/20 text-white text-xs px-2 focus:outline-none"
                  >
                    <option value="" className="text-black">Todos</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id} className="text-black">{u.nome_completo}</option>
                    ))}
                  </select>
                )}
              </div>
            </motion.div>

            {/* Mini stats */}
            <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
              {COLUMNS.map((col, i) => (
                <motion.div key={col.key} className="flex-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="rounded-lg bg-white/[0.05] border border-white/10 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", col.dotColor)} />
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider truncate">{col.label}</p>
                      <p className="text-base sm:text-lg font-bold tabular-nums">{grouped[col.key].length}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Board */}
        <main className="container py-4 sm:py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col, i) => (
              <div key={col.key}>
                <AnimatedCard index={i}>
                  <KanbanColumn
                    column={col}
                    tarefas={grouped[col.key]}
                    usuarios={usuarios}
                    onAdd={() => openNewDialog(col.key)}
                    onMove={handleMove}
                    onDelete={handleDelete}
                    onEdit={openEditDialog}
                  />
                </AnimatedCard>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTarefa ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Título da tarefa"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSave()}
              autoFocus
            />
            <Textarea
              placeholder="Descrição (opcional)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PRIORIDADE_CONFIG) as [Prioridade, typeof PRIORIDADE_CONFIG[Prioridade]][]).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-1.5">
                          <cfg.icon className={cn("h-3 w-3", cfg.color)} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!editingTarefa && (
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Coluna</label>
                  <Select value={dialogStatus} onValueChange={(v) => setDialogStatus(v as TarefaStatus)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map(c => (
                        <SelectItem key={c.key} value={c.key}>
                          <span className="flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", c.dotColor)} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Mencionados</label>
              <UserPicker selected={mencionados} onChange={setMencionados} usuarios={usuarios} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createTarefa.isPending || updateTarefa.isPending}>
              {(createTarefa.isPending || updateTarefa.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTarefa ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default MinhasPendencias;
