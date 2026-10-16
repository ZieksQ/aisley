import type { ButtonProps } from '@aisley/ui'
import { PortalButton, PortalState } from '@aisley/ui/portal'
import './orders.css'

export const orderPanel = 'order-surface'
export const orderLink = 'order-text-link'

export function OrderButton({ variant = 'outline', ...props }: ButtonProps) {
  return (
    <PortalButton
      {...props}
      variant={variant === 'primary' || variant === 'secondary'
        ? 'primary'
        : variant === 'ghost' ? 'ghost' : 'default'}
    />
  )
}

export function OrderError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="my-4">
      <PortalState error title={message} action={<OrderButton onClick={retry}>Try again</OrderButton>} />
    </div>
  )
}
