import { ReactNode } from 'react';
import {
  FileX,
  Search,
  Inbox,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'inline') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-3 text-muted-foreground ${className}`}
      >
        <Icon className="h-5 w-5" />
        <span className="text-sm">{title}</span>
      </motion.div>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex flex-col items-center justify-center py-10 text-center ${className}`}
      >
        <div className="p-3 rounded-full bg-muted/60 mb-3">
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="p-4 rounded-full bg-muted/60 mb-4"
      >
        <Icon className="h-12 w-12 text-muted-foreground/50" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-lg font-semibold text-foreground mb-2"
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-muted-foreground max-w-sm mb-6"
        >
          {description}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {action && (
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button onClick={secondaryAction.onClick} variant="outline" size="sm">
            {secondaryAction.label}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

export function EmptySearchState({
  searchTerm,
  onClear
}: {
  searchTerm: string;
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={Search}
      title="Nenhum resultado encontrado"
      description={`Não encontramos nenhum item correspondente a "${searchTerm}". Tente buscar com termos diferentes.`}
      action={{ label: 'Limpar busca', onClick: onClear }}
    />
  );
}

export function EmptyTableState({
  title = 'Nenhum dado encontrado',
  description = 'Ainda não há registros para exibir.',
  icon = FolderOpen,
  action,
}: Partial<EmptyStateProps>) {
  return (
    <div className="py-12 border-t">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={action}
        variant="compact"
      />
    </div>
  );
}
