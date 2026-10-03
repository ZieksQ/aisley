import type { ServiceType } from './types'

export const serviceLabels: Record<ServiceType, string> = {
  first_mile: 'First mile',
  linehaul: 'Linehaul',
  last_mile: 'Last mile',
}

export const serviceTypes = Object.keys(serviceLabels) as ServiceType[]

export function peso(cents: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100)
}

export function manilaDate(value: string | null): string {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

export function kilograms(grams: number): string {
  return `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 }).format(grams / 1000)} kg`
}

export function centimeters(millimeters: number): string {
  return `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 }).format(millimeters / 10)} cm`
}

