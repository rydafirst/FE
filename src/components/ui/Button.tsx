import type { ButtonHTMLAttributes } from 'react';
export function Button({ variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return <button {...props} className={`rf-btn${variant === 'ghost' ? ' rf-btn--ghost' : ''}`} />;
}
