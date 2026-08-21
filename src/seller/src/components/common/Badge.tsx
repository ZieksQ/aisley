import React from 'react';

type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'neutral'
  | 'dark';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const variantStyles = {
    primary:
      'bg-[#FDF2F9] dark:bg-pink-950/70 text-[#B50E77] dark:text-pink-300 border border-[#F9CFEA] dark:border-pink-800/80',
    success:
      'bg-[#ECFDF5] dark:bg-emerald-950/70 text-[#059669] dark:text-emerald-300 border border-[#A7F3D0] dark:border-emerald-800/80',
    warning:
      'bg-[#FFFBEB] dark:bg-amber-950/70 text-[#D97706] dark:text-amber-300 border border-[#FDE68A] dark:border-amber-800/80',
    info:
      'bg-[#F0F9FF] dark:bg-sky-950/70 text-[#0284C7] dark:text-sky-300 border border-[#BAE6FD] dark:border-sky-800/80',
    danger:
      'bg-[#FEF2F2] dark:bg-rose-950/70 text-[#DC2626] dark:text-rose-300 border border-[#FECACA] dark:border-rose-800/80',
    neutral:
      'bg-[#F8FAFC] dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700',
    dark:
      'bg-[#0F172A] dark:bg-slate-900 text-white dark:text-slate-100 border border-[#1E293B] dark:border-slate-700',
  }[variant];

  const dotColors = {
    primary: 'bg-[#E723A2] dark:bg-pink-400',
    success: 'bg-[#10B981] dark:bg-emerald-400',
    warning: 'bg-[#F59E0B] dark:bg-amber-400',
    info: 'bg-[#0284C7] dark:bg-sky-400',
    danger: 'bg-[#EF4444] dark:bg-rose-400',
    neutral: 'bg-[#64748B] dark:bg-slate-400',
    dark: 'bg-white',
  }[variant];

  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-full tracking-wide shrink-0 transition-colors ${variantStyles} ${sizeStyles} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full shrink-0 ${dotColors}`} />}
      <span className="leading-tight">{children}</span>
    </span>
  );
};
