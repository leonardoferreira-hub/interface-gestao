import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const statusConfig: Record<string, StatusConfig> = {
  'ok': {
    bg: 'bg-emerald-100 dark:bg-emerald-900/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'OK'
  },
  'pendente': {
    bg: 'bg-amber-100 dark:bg-amber-900/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'PENDENTE'
  },
  'nok': {
    bg: 'bg-rose-100 dark:bg-rose-900/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    label: 'NOK'
  },
  'em_analise': {
    bg: 'bg-sky-100 dark:bg-sky-900/50',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-700',
    label: 'EM ANALISE'
  },
  'aprovado': {
    bg: 'bg-emerald-100 dark:bg-emerald-900/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'APROVADO'
  },
  'reprovado': {
    bg: 'bg-rose-100 dark:bg-rose-900/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    label: 'REPROVADO'
  },
  'Em Estruturação': {
    bg: 'bg-sky-100 dark:bg-sky-900/50',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-700',
    label: 'EM ESTRUTURAÇÃO'
  },
  'Liquidada': {
    bg: 'bg-emerald-100 dark:bg-emerald-900/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'LIQUIDADA'
  },
  'On Hold': {
    bg: 'bg-amber-100 dark:bg-amber-900/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'ON HOLD'
  },
  'Abortada': {
    bg: 'bg-rose-100 dark:bg-rose-900/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    label: 'ABORTADA'
  },
  'Finalizada': {
    bg: 'bg-slate-100 dark:bg-slate-900/50',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    label: 'FINALIZADA'
  }
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status] || statusConfig['pendente'];

  return (
    <motion.span
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1",
        "text-[11px] font-semibold tracking-wide",
        "border rounded-full",
        "shadow-sm shadow-black/0",
        "transition-colors duration-150",
        config.border,
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </motion.span>
  );
};
