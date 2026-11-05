export type ReportPeriod = { from: string; to: string; allTime: boolean }
export type ReportFilters = { params: URLSearchParams; setParams: (params: URLSearchParams) => void }
export type PeriodPreset = 'today' | 'week' | 'month' | 'last-month' | 'thirty' | 'all' | 'custom'

export function manilaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-')
}

function offset(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function presetPeriod(preset: PeriodPreset, today = manilaToday()): ReportPeriod {
  const month = `${today.slice(0, 7)}-01`
  if (preset === 'all') return { from: '', to: '', allTime: true }
  if (preset === 'last-month') {
    const to = offset(month, -1)
    return { from: `${to.slice(0, 7)}-01`, to, allTime: false }
  }
  return { from: preset === 'today' ? today : preset === 'week' ? offset(today, -6) : preset === 'thirty' ? offset(today, -29) : month, to: today, allTime: false }
}

export function periodQuery(period: ReportPeriod) {
  return new URLSearchParams(period.allTime ? { all_time: '1' } : { date_from: period.from, date_to: period.to })
}

export function useReportPeriod({ params, setParams }: ReportFilters) {
  const hasDates = params.has('date_from') || params.has('date_to')
  const period: ReportPeriod = params.get('all_time') === '1'
    ? { from: '', to: '', allTime: true }
    : hasDates ? { from: params.get('date_from') ?? '', to: params.get('date_to') ?? '', allTime: false } : presetPeriod('month')
  const query = periodQuery(period).toString()
  function apply(next: ReportPeriod) {
    const updated = new URLSearchParams(params)
    for (const key of ['date_from', 'date_to', 'all_time', 'page', 'history_page']) updated.delete(key)
    periodQuery(next).forEach((value, key) => updated.set(key, value))
    setParams(updated)
  }
  return { period, query, apply }
}
