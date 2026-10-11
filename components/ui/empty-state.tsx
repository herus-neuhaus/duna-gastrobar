import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('ui-empty-state', className)}>
      {icon && <div className="ui-empty-icon" aria-hidden="true">{icon}</div>}
      <p className="ui-empty-title">{title}</p>
      {description && <p className="ui-empty-description">{description}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
