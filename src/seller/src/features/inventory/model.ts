import type { InventorySku } from '../../types/operations'

export type Movement = {
  id: string
  movement_type: string
  on_hand_delta: number
  reserved_delta: number
  resulting_on_hand: number
  resulting_reserved: number
  reason: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

export function variantLabel(variant: InventorySku['variant']) {
  return (
    variant?.option_values
      .map(({ group, value }) => (group ? `${group}: ${value}` : value))
      .join(' / ') ?? ''
  )
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

export function label(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}
