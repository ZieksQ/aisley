const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const compactPeso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const amount = (cents: number) => peso.format(cents / 100)
export const compactAmount = (cents: number) => compactPeso.format(cents / 100)
export const chartDate = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
