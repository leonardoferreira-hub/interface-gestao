import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Loader2, TrendingUp, TrendingDown, Clock,
  CheckCircle2, AlertTriangle, Users, CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition, AnimatedCard } from '@/components/ui/animations';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { useKpiRotinas } from '@/hooks/useKpiRotinas';
import { useKpiTarefas } from '@/hooks/useKpiTarefas';
import { useEquipeGestao } from '@/hooks/useEquipeGestao';

// ── Colors ──
const COLORS = {
  emDia: '#10b981',
  atrasada: '#ef4444',
  antecipada: '#3b82f6',
  todo: '#f59e0b',
  doing: '#3b82f6',
  validating: '#a855f7',
  done: '#10b981',
};

const COLUMN_LABELS: Record<string, string> = {
  todo: 'A Fazer',
  doing: 'Em Andamento',
  validating: 'Em Validação',
  done: 'Concluído',
};

// ── Stat Card ──
function StatCard({ label, value, suffix, icon: Icon, color }: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.05] border border-white/10 p-3 flex items-center gap-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wider truncate">{label}</p>
        <p className="text-lg font-bold tabular-nums text-white">
          {value}{suffix && <span className="text-sm font-normal text-white/50 ml-0.5">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

// ── KPI Card wrapper ──
function KpiCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-2 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{p.unit || ''}</span>
        </p>
      ))}
    </div>
  );
}

// ── Page ──
const KPIs = () => {
  // Auth check
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { data: usuarios = [] } = useEquipeGestao();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (userId && usuarios.length) {
        const user = usuarios.find(u => u.id === userId);
        setCurrentUserRole(user?.role || null);
      }
      setAuthLoading(false);
    });
  }, [usuarios]);

  const canSeeKpis = currentUserRole === 'admin' || currentUserRole === 'coordenador_gestao' || currentUserRole === 'coordenador_rh';

  // Filtro por analista
  const [selectedAnalista, setSelectedAnalista] = useState<string | null>(null);

  // KPI data — passes analyst filter
  const [mesesAtras] = useState(6);
  const { data: kpiRotinas, isLoading: loadingRotinas } = useKpiRotinas(mesesAtras, selectedAnalista);
  const { data: kpiTarefas, isLoading: loadingTarefas } = useKpiTarefas(selectedAnalista);

  // Redirect unauthorized
  if (!authLoading && !canSeeKpis) return <Navigate to="/" replace />;

  const isLoading = authLoading || loadingRotinas || loadingTarefas;

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

  // Prepare chart data
  const distribuicaoData = kpiTarefas ? [
    { name: 'A Fazer', value: kpiTarefas.distribuicaoAtual.todo, color: COLORS.todo },
    { name: 'Em Andamento', value: kpiTarefas.distribuicaoAtual.doing, color: COLORS.doing },
    { name: 'Em Validação', value: kpiTarefas.distribuicaoAtual.validating, color: COLORS.validating },
    { name: 'Concluído', value: kpiTarefas.distribuicaoAtual.done, color: COLORS.done },
  ].filter(d => d.value > 0) : [];

  const tempoColunasData = kpiTarefas ? [
    { name: 'A Fazer', horas: kpiTarefas.tempoMedioPorColuna.todo, fill: COLORS.todo },
    { name: 'Em Andamento', horas: kpiTarefas.tempoMedioPorColuna.doing, fill: COLORS.doing },
    { name: 'Em Validação', horas: kpiTarefas.tempoMedioPorColuna.validating, fill: COLORS.validating },
  ] : [];

  const selectedAnalistaName = selectedAnalista
    ? usuarios.find(u => u.id === selectedAnalista)?.nome_completo?.split(' ')[0] || 'Analista'
    : null;

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
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-pink-300" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight">KPIs — Gestão</h1>
                  <p className="text-white/50 text-xs sm:text-sm">
                    Últimos {mesesAtras} meses{selectedAnalistaName ? ` · ${selectedAnalistaName}` : ''} · Acesso restrito
                  </p>
                </div>
              </div>

              {/* Filtro por analista */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white/40" />
                <select
                  value={selectedAnalista || ''}
                  onChange={(e) => setSelectedAnalista(e.target.value || null)}
                  className="h-8 rounded-md bg-white/10 border border-white/20 text-white text-xs px-3 pr-8 focus:outline-none focus:ring-1 focus:ring-white/30 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="" className="text-black">Todos os analistas</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id} className="text-black">{u.nome_completo}</option>
                  ))}
                </select>
              </div>
            </motion.div>

            {/* Mini stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <StatCard label="Taxa em dia" value={kpiRotinas?.taxaEmDia.toFixed(0) || '0'} suffix="%" icon={CheckCircle2} color="bg-emerald-500/20" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <StatCard label="Atraso médio" value={kpiRotinas?.atrasoMedioDias.toFixed(1) || '0'} suffix="dias" icon={AlertTriangle} color="bg-red-500/20" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <StatCard label="Lead time" value={kpiTarefas?.leadTimeMedio.toFixed(1) || '0'} suffix="dias" icon={Clock} color="bg-blue-500/20" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <StatCard label="Tarefas ativas" value={kpiTarefas?.totalTarefas || 0} icon={TrendingUp} color="bg-purple-500/20" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="container py-4 sm:py-6 space-y-6">

          {/* ── Seção: Rotinas ── */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Rotinas — Cumprimento de Prazos
            </h2>

            {/* Taxas gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <AnimatedCard index={0}>
                <Card className="border-l-[3px] border-l-emerald-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-600">{kpiRotinas?.taxaEmDia.toFixed(0) || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Em dia ou antecipadas</p>
                    {(kpiRotinas?.antecipacaoMediaDias || 0) > 0 && (
                      <Badge variant="outline" className="mt-2 text-[10px] gap-1 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <TrendingDown className="h-3 w-3" />
                        {kpiRotinas!.antecipacaoMediaDias.toFixed(1)} dias antes (média)
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard index={1}>
                <Card className="border-l-[3px] border-l-red-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">{kpiRotinas?.taxaAtrasada.toFixed(0) || 0}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Atrasadas</p>
                    {(kpiRotinas?.atrasoMedioDias || 0) > 0 && (
                      <Badge variant="outline" className="mt-2 text-[10px] gap-1 border-0 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        <TrendingUp className="h-3 w-3" />
                        {kpiRotinas!.atrasoMedioDias.toFixed(1)} dias de atraso (média)
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard index={2}>
                <Card className="border-l-[3px] border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{kpiRotinas?.totalCumprimentos || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Rotinas analisadas</p>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Evolução mensal */}
              <AnimatedCard index={3}>
                <KpiCard title="Evolução mensal — Taxa de entrega">
                  {kpiRotinas?.evolucaoMensal.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={kpiRotinas.evolucaoMensal}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="taxaEmDia" name="Em dia" stroke={COLORS.emDia} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="taxaAtrasada" name="Atrasada" stroke={COLORS.atrasada} strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Sem dados suficientes</p>
                  )}
                </KpiCard>
              </AnimatedCard>

              {/* Atraso por rotina */}
              <AnimatedCard index={4}>
                <KpiCard title="Atraso médio por rotina (dias)">
                  {kpiRotinas?.porRotina.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kpiRotinas.porRotina} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" tick={{ fontSize: 11 }} unit=" d" />
                        <YAxis type="category" dataKey="rotinaNome" width={130} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="atrasoMedioDias" name="Atraso médio" fill={COLORS.atrasada} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Sem dados suficientes</p>
                  )}
                </KpiCard>
              </AnimatedCard>
            </div>

            {/* Tabela por analista (only when NOT filtering by analyst) */}
            {!selectedAnalista && kpiRotinas?.porAnalista.length ? (
              <AnimatedCard index={5}>
                <KpiCard title="Performance por analista" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Analista</th>
                          <th className="pb-2 font-medium text-center">Total</th>
                          <th className="pb-2 font-medium text-center">Em dia</th>
                          <th className="pb-2 font-medium text-center">Taxa</th>
                          <th className="pb-2 font-medium text-center">Atraso médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiRotinas.porAnalista.map(a => (
                          <tr
                            key={a.analistaId}
                            className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedAnalista(a.analistaId)}
                          >
                            <td className="py-2 flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                                {a.analistaNome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                              {a.analistaNome.split(' ')[0]}
                            </td>
                            <td className="py-2 text-center">{a.total}</td>
                            <td className="py-2 text-center text-emerald-600 font-medium">{a.emDia}</td>
                            <td className="py-2 text-center">
                              <Badge variant="outline" className={cn(
                                "text-[10px] border-0",
                                a.total > 0 && (a.emDia / a.total) >= 0.8
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/40'
                              )}>
                                {a.total > 0 ? ((a.emDia / a.total) * 100).toFixed(0) : 0}%
                              </Badge>
                            </td>
                            <td className="py-2 text-center text-muted-foreground">
                              {a.atrasoMedioDias > 0 ? `${a.atrasoMedioDias.toFixed(1)}d` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </KpiCard>
              </AnimatedCard>
            ) : null}
          </div>

          {/* ── Seção: Tarefas (Kanban) ── */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tarefas — Tempo no Kanban
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <AnimatedCard index={6}>
                <Card className="border-l-[3px] border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{kpiTarefas?.leadTimeMedio.toFixed(1) || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Lead time médio (dias)</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Criação → Concluído</p>
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard index={7}>
                <Card className="border-l-[3px] border-l-emerald-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-600">{kpiTarefas?.tarefasConcluidas || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Concluídas</p>
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard index={8}>
                <Card className="border-l-[3px] border-l-amber-500">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{kpiTarefas?.totalTarefas || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total ativas</p>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tempo médio por coluna */}
              <AnimatedCard index={9}>
                <KpiCard title="Tempo médio por coluna (horas)">
                  {tempoColunasData.some(d => d.horas > 0) ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={tempoColunasData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]}>
                          {tempoColunasData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Dados de tempo por coluna</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Serão coletados a partir de agora via trigger automático</p>
                    </div>
                  )}
                </KpiCard>
              </AnimatedCard>

              {/* Distribuição atual */}
              <AnimatedCard index={10}>
                <KpiCard title="Distribuição atual do Kanban">
                  {distribuicaoData.length ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={distribuicaoData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {distribuicaoData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhuma tarefa no kanban</p>
                  )}
                </KpiCard>
              </AnimatedCard>
            </div>
          </div>

        </main>
      </div>
    </PageTransition>
  );
};

export default KPIs;
