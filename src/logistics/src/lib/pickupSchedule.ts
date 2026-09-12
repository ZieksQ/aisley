export const PICKUP_TIME_ZONE = 'Asia/Manila'

export type ScheduleWindow = {
  date: string
  startTime: string
  endTime: string
}

export function toUtc(date: string, time: string): string {
  if (!date || !time) return ''

  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
  const parsed = new Date(`${date}T${normalizedTime}+08:00`)

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

export function formatPhtTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: PICKUP_TIME_ZONE }).format(new Date(value))
}
