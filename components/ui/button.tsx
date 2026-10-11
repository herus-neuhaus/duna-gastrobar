import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'gold' | 'dark' | 'whatsapp';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'is-primary',
  secondary: 'is-outline',
  danger: 'is-outline ui-button-danger',
  success: 'ui-button-success',
  ghost: 'is-ghost',
  gold: 'duna-gold-button',
  dark: 'duna-dark-link',
  whatsapp: 'duna-whatsapp-button',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'is-sm',
  md: '',
  lg: 'is-lg',
  icon: 'is-icon',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn('tuc-btn ui-button', variants[variant], sizes[size], className)} {...props} />;
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <a className={cn('tuc-btn ui-button', variants[variant], sizes[size], className)} {...props} />;
}
