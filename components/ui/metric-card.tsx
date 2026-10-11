import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  className?: string;
};

const tones = {
  default: 'ui-metric-default',
  warning: 'ui-metric-warning',
  danger: 'ui-metric-danger',
  success: 'ui-metric-success',
};

export function MetricCard({ label, value, detail, icon, tone = 'default', className }: MetricCardProps) {
  return (
    <section className={cn('ui-metric-card', tones[tone], className)}>
      {icon && <span className="ui-metric-icon" aria-hidden="true">{icon}</span>}
      <div className="min-w-0">
        <p className="ui-metric-label">{label}</p>
        <p className="ui-metric-value">{value}</p>
        {detail && <p className="ui-metric-detail">{detail}</p>}
      </div>
    </section>
  );
}
