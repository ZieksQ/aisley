import { useId, useState } from 'react'
import { LuCalendarDays } from 'react-icons/lu'
import { manilaToday, presetPeriod, type PeriodPreset, type ReportPeriod } from './period'
import './date-range.css'

export type DateRangePickerProps = {
  value: ReportPeriod
  onApply: (value: ReportPeriod) => void
  label?: string
  disabled?: boolean
}

export function DateRangePicker(props: DateRangePickerProps) {
  return <DateRangeForm key={`${props.value.from}:${props.value.to}:${props.value.allTime}`} {...props} />
}

function DateRangeForm({ value, onApply, label = 'Reporting period', disabled = false }: DateRangePickerProps) {
  const id = useId()
  const today = manilaToday()
  const initial = (['month', 'today', 'week', 'thirty', 'last-month', 'all'] as const).find((key) => {
    const period = presetPeriod(key, today)
    return period.from === value.from && period.to === value.to && period.allTime === value.allTime
  }) ?? 'custom'
  const [preset, setPreset] = useState<PeriodPreset>(initial)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const dirty = draft.from !== value.from || draft.to !== value.to || draft.allTime !== value.allTime
  return <form className="report-period" aria-label={label} onSubmit={(event) => {
    event.preventDefault()
    if (!draft.allTime && (!draft.from || !draft.to || draft.from > draft.to || draft.to > today)) {
      setError('Choose a start date on or before the end date, through today in Manila.')
      return
    }
    setError('')
    onApply(draft)
  }}>
    <div className="report-period-context"><LuCalendarDays aria-hidden="true" /><span>{label}<small>Asia/Manila</small></span></div>
    <label htmlFor={`${id}-preset`}>Period
      <select id={`${id}-preset`} value={preset} disabled={disabled} onChange={(event) => {
        const next = event.target.value as PeriodPreset
        setPreset(next)
        setError('')
        setDraft(next === 'custom' ? { ...(draft.allTime ? presetPeriod('month', today) : draft), allTime: false } : presetPeriod(next, today))
      }}>
        <option value="today">Today</option><option value="week">Last 7 days</option><option value="thirty">Last 30 days</option><option value="month">This month</option><option value="last-month">Last month</option><option value="all">All time</option><option value="custom">Custom range</option>
      </select>
    </label>
    {!draft.allTime && <>
      <label htmlFor={`${id}-from`}>From<input id={`${id}-from`} type="date" required max={draft.to && draft.to < today ? draft.to : today} disabled={disabled} value={draft.from} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setPreset('custom'); setDraft({ ...draft, from: event.target.value }); setError('') }} /></label>
      <label htmlFor={`${id}-to`}>To<input id={`${id}-to`} type="date" required min={draft.from} max={today} disabled={disabled} value={draft.to} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setPreset('custom'); setDraft({ ...draft, to: event.target.value }); setError('') }} /></label>
    </>}
    <div className="report-period-actions">
      <button className="report-period-apply" type="submit" disabled={disabled}>Apply</button>
      <button type="button" disabled={disabled || !dirty} onClick={() => { setDraft(value); setPreset(initial); setError('') }}>Cancel</button>
    </div>
    {error && <p className="report-period-error" id={`${id}-error`} role="alert">{error}</p>}
  </form>
}
