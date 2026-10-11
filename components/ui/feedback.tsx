import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
type FeedbackProps = HTMLAttributes<HTMLDivElement> & { tone?: FeedbackTone };

const tones: Record<FeedbackTone, string> = {
  info: 'is-info',
  success: 'is-success',
  warning: 'is-warning',
  error: 'is-danger',
};

export function Feedback({ tone = 'info', className, role = 'status', children, ...props }: FeedbackProps) {
  return <div className={cn('tuc-alert', tones[tone], className)} role={role} {...props}><div className="tuc-alert__body">{children}</div></div>;
}
