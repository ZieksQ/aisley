export const panelClass = 'rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]'

export const inputClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#4C1268] focus:ring-2 focus:ring-[#E6007A]/20 disabled:bg-slate-100 disabled:text-slate-500 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:focus:border-[#E6007A] dark:disabled:bg-white/[0.03] dark:disabled:text-slate-400'

export const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#0b0d13]'

export const secondaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] focus-visible:ring-offset-2 disabled:opacity-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-offset-[#0b0d13]'

export function formatMoney(cents: number, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(cents / 100)
}

export function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function toLocalDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000)
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

export function statusClass(status: string) {
  return status === 'published'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'
    : 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200'
}
