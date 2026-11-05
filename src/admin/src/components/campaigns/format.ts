export function campaignDate(value: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
export function campaignNumber(value: number) {
  return new Intl.NumberFormat('en-PH').format(value)
}
