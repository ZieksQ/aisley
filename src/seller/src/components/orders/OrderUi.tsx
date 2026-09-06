import { Button, type ButtonProps } from '@aisley/ui'

export const orderPanel = 'rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]'
export const orderLink = 'font-medium text-[#4C1268] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-purple-300'

export function OrderButton({ className = '', variant = 'outline', ...props }: ButtonProps) {
  return <Button {...props} variant={variant} className={`min-h-10! rounded-lg! px-4! shadow-none! ${variant === 'outline' ? 'dark:border-white/20 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/10' : ''} ${className}`} />
}

export function OrderError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">
    <p>{message}</p>
    <OrderButton className="mt-3" onClick={retry}>Try again</OrderButton>
  </div>
}
