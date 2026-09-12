export const PICKUP_TIME_ZONE = 'Asia/Manila'

export type ScheduleWindow = {
  startDateTime: string
  endDateTime: string
}

export function toUtc(date: string, time: string): string
export function toUtc(dateTime: string): string
export function toUtc(dateOrDateTime: string, time?: string): string {
  if (!dateOrDateTime || (time !== undefined && !time)) return ''

  const localDateTime = time ? `${dateOrDateTime}T${/^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time}` : dateOrDateTime.replace(' ', 'T')
  const normalizedDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime) ? `${localDateTime}:00` : localDateTime
  const parsed = new Date(`${normalizedDateTime}+08:00`)

  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

export function localParts(value: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: PICKUP_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

export function formatPhtDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: PICKUP_TIME_ZONE }).format(new Date(`${value}T12:00:00+08:00`))
}

export function formatPhtDateTime(value: string): string {
  const parsed = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? new Date(value) : new Date(toUtc(value))

  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: PICKUP_TIME_ZONE }).format(parsed)
}

export function formatPhtTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: PICKUP_TIME_ZONE }).format(new Date(value))
}

export function localDateTime(value: string): string {
  const parts = localParts(value)

  return `${parts.date} ${parts.time}`
}
