export const workflowButton = '!min-h-10 !rounded-md !px-3 !shadow-none dark:border-white/20 dark:!bg-zinc-800 dark:!text-zinc-100 dark:hover:!bg-zinc-700'
export const money = (cents: number, currency = 'PHP') => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(cents / 100)
export const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : '—'
export const workspace = 'mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8'
