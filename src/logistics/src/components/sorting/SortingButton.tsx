import { Button, type ButtonProps } from '@aisley/ui'

export function SortingButton(props: ButtonProps) {
  return <Button variant="outline" {...props} className={`min-h-9! rounded-md! px-3! py-1! shadow-none! dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10 ${props.className ?? ''}`} />
}
