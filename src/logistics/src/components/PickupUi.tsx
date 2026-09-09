import type { ReactNode } from 'react'
import { FaArrowsRotate } from 'react-icons/fa6'

export const panel = 'border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]'
export const field = 'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 dark:border-white/15 dark:bg-[#111113] dark:focus:border-purple-400'
export const link = 'font-medium text-[#4C1268] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-purple-300'

export function ActionButton({ children, busy, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; busy?: boolean }) {
  return <button {...props} aria-busy={busy} disabled={props.disabled || busy} className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:hover:bg-white/10 ${className}`}>{busy ? <><FaArrowsRotate className="animate-spin" aria-hidden="true" />Working…</> : children}</button>
}

export function PrimaryButton({ className = '', ...props }: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton {...props} className={`border-[#4C1268]! bg-[#4C1268]! text-white hover:bg-[#3d0e54]! ${className}`} />
}

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert"><p>{message}</p>{retry ? <button className="mt-2 font-semibold underline" onClick={retry} type="button">Try again</button> : null}</div>
}

export function StatusLabel({ status }: { status: string }) {
  const label = status.replaceAll('_', ' ')
  const tone = status === 'scheduled' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300' : status === 'partially_scheduled' ? 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200' : 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300'
  return <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium capitalize ${tone}`}>{label}</span>
}

export function manilaDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}
