import { cn } from '@/lib/utils';

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type StatusBadgeProps = { label: string; tone?: StatusTone; className?: string };

const tones: Record<StatusTone, string> = {
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
  info: 'is-info',
  neutral: 'is-plain',
};

const reservationStatuses: Record<string, { label: string; tone: StatusTone }> = {
  confirmed: { label: 'Confirmada', tone: 'success' },
  confirmado: { label: 'Confirmada', tone: 'success' },
  pending: { label: 'Pendente', tone: 'warning' },
  pendente: { label: 'Pendente', tone: 'warning' },
  cancelled: { label: 'Cancelada', tone: 'danger' },
  cancelado: { label: 'Cancelada', tone: 'danger' },
  no_show: { label: 'Não compareceu', tone: 'warning' },
  seated: { label: 'Em atendimento', tone: 'info' },
  completed: { label: 'Concluída', tone: 'neutral' },
  concluido: { label: 'Concluída', tone: 'neutral' },
};

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return <span className={cn('tuc-badge', tones[tone], className)}>{label}</span>;
}

export function ReservationStatusBadge({ status }: { status: string | null }) {
  const normalized = (status || 'pending').toLowerCase();
  const value = reservationStatuses[normalized] || { label: status || 'Pendente', tone: 'neutral' as const };
  return <StatusBadge label={value.label} tone={value.tone} />;
}
