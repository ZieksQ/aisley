import type { LinehaulOption } from '../components/LinehaulOptionPicker'
import type { LinehaulDriver } from '../types/linehaulTrips'

const scheduleTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
})

export function linehaulDriverOption(driver: LinehaulDriver): LinehaulOption {
  return {
    id: driver.id,
    title: driver.name,
    description: 'Approved company-truck driver',
    disabled: !driver.available,
    status: driver.available ? 'Available' : 'Busy — ongoing assignment',
    information: [
      ...(driver.work ?? []).map((work) => {
        if (work.type === 'other') return 'Outstanding work with another organization'
        const label = { pickup: 'Pickup', delivery: 'Delivery', linehaul: 'Linehaul' }[work.type]
        const date = work.scheduled_for ? new Date(work.scheduled_for) : null
        const time = date && Number.isFinite(date.getTime()) ? `${scheduleTime.format(date)} PHT` : 'Schedule time unavailable'
        return [label, work.reference, work.status.replaceAll('_', ' '), time, work.route].filter(Boolean).join(' · ')
      }),
      driver.operational_location ?? 'Location unavailable',
    ],
  }
}
