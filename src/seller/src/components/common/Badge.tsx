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
    primary: 'bg-[#FDF2F9] text-[#B50E77] border border-[#F9CFEA]',
    success: 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]',
    warning: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
    info: 'bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]',
    danger: 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
    neutral: 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]',
    dark: 'bg-[#0F172A] text-white border border-[#1E293B]',
  }[variant];

  const dotColors = {
    primary: 'bg-[#E723A2]',
    success: 'bg-[#10B981]',
    warning: 'bg-[#F59E0B]',
    info: 'bg-[#0284C7]',
    danger: 'bg-[#EF4444]',
    neutral: 'bg-[#64748B]',
    dark: 'bg-white',
  }[variant];

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full tracking-wide shrink-0 ${variantStyles} ${sizeStyles} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full shrink-0 ${dotColors}`} />}
      {children}
    </span>
  );
};
