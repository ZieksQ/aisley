import type { ButtonHTMLAttributes } from 'react'

export type PortalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  isLoading?: boolean
  loadingLabel?: string
}

export function PortalButton({
  variant = 'default',
  isLoading = false,
  loadingLabel = 'Please wait…',
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: PortalButtonProps) {
  return (
    <button
      {...props}
      className={`portal-button ${variant === 'default' ? '' : `portal-button-${variant}`} ${className}`}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? loadingLabel : children}
    </button>
  )
}
