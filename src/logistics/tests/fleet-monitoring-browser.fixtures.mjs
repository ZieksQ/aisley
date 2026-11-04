import { installRatesFleetFixtures } from './rates-fleet-browser.fixtures.mjs'

export function installMonitoringFixtures() {
  const original = window.fetch.bind(window)
  const statuses = ['available', 'reserved', 'in_transit', 'unloading', 'visiting', 'inactive']
  const at = '2026-11-04T04:00:00Z'
  const hub = { id: 'local', name: 'San Pedro hub' }
  const destination = { id: 'davao', name: 'Davao hub' }
  const trips = Array.from({ length: 23 }, (_, index) => ({
    id: `trip-${index}`, direction: index % 2 ? 'return' : 'outbound', status: index === 0 ? 'pending_acceptance' : index % 2 ? 'cancelled' : 'received',
    from_hub: hub, to_hub: destination, driver: { id: 'driver', name: 'Rafael Mendoza' },
    parcel_count: index === 1 ? 0 : 120, capacity_snapshot: 250,
    scheduled_for: '2026-11-04T02:00:00Z', overdue: index === 0,
    decided_at: null, released_for_departure_at: null, departed_at: null,
    courier_arrived_at: index === 2 ? at : null, arrived_at: null, unloading_closed_at: null, received_at: null,
  }))
  const trucks = Array.from({ length: 23 }, (_, index) => ({
    id: `truck-${index}`, plate_number: `NDR ${4827 + index}`, make: 'Isuzu', model: 'N-Series',
    is_active: index % 6 !== 5, availability: statuses[index % 6], home_hub: hub, last_confirmed_hub: hub,
    max_parcels: 250, reserved_or_onboard_parcels: [1, 2, 3].includes(index % 6) && index !== 7 ? 120 : 0,
    remaining_capacity: [1, 2, 3].includes(index % 6) && index !== 7 ? 130 : 250,
    active_trip: [1, 2, 3].includes(index % 6) ? { ...trips[0], id: `active-${index}`, direction: index === 7 ? 'return' : 'outbound', parcel_count: index === 7 ? 0 : 120, from_hub: index === 7 ? destination : hub, to_hub: index === 7 ? hub : destination, status: index % 6 === 3 ? 'receiving' : index % 6 === 2 ? 'in_transfer' : 'pending_acceptance', overdue: index % 6 === 1, departed_at: index % 6 === 2 ? at : null, courier_arrived_at: index % 6 === 2 ? at : null } : null,
  }))
  const state = window.monitoringFixture = { mode: 'normal', reads: [], pending: [], interval: null }
  const interval = window.setInterval.bind(window)
  window.setInterval = (callback, delay, ...args) => {
    if (delay === 30000) state.interval = callback
    return interval(callback, delay, ...args)
  }
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const page = (rows, url) => {
    const number = Number(url.searchParams.get('page') || 1)
    return { data: rows.slice((number - 1) * 20, number * 20), meta: { current_page: number, last_page: Math.max(1, Math.ceil(rows.length / 20)), total: rows.length, per_page: 20, server_time: at } }
  }
  window.fetch = async (input, options = {}) => {
    const url = new URL(String(input), location.origin)
    const path = url.pathname
    if (!path.includes('/fleet/monitoring')) return original(input, options)
    state.reads.push(path + url.search)
    const mode = state.mode
    if (mode === 'delay') await new Promise((resolve) => state.pending.push(resolve))
    if (mode === 'error') return json({ message: 'Monitoring connection interrupted.' }, 503)
    if (mode === 'forbidden') return json({ code: 'POLICY_CONSENT_REQUIRED', message: 'Consent required.' }, 403)
    if (mode === 'unauthorized') return json({ message: 'Unauthenticated.' }, 401)
    if (path.endsWith('/monitoring')) {
      let rows = mode === 'empty' ? [] : trucks
      const term = url.searchParams.get('search')?.toLowerCase()
      if (term) rows = rows.filter((truck) => `${truck.plate_number} ${truck.make} ${truck.active_trip?.driver.name ?? ''} ${truck.active_trip?.to_hub.name ?? ''}`.toLowerCase().includes(term))
      const status = url.searchParams.get('availability')
      if (status) rows = rows.filter((truck) => truck.availability === status)
      if (url.searchParams.get('overdue') === '1') rows = rows.filter((truck) => truck.active_trip?.overdue)
      const response = page(rows, url)
      response.meta.summary = Object.fromEntries(statuses.map((status) => [status, mode === 'empty' ? 0 : trucks.filter((truck) => truck.availability === status).length]))
      return json(response)
    }
    const id = path.split('/monitoring/')[1].split('/')[0]
    const truck = trucks.find((truck) => truck.id === id)
    if (!truck) return json({ message: 'Truck unavailable.' }, 404)
    if (path.endsWith('/trips')) return json(page(mode === 'empty' ? [] : [truck.active_trip ?? { ...trips[0], status: 'received', overdue: false }, ...trips.slice(1)], url))
    return json({ data: truck, meta: { server_time: at } })
  }
}

export const fixtureSource = `(${installRatesFleetFixtures.toString()})(); (${installMonitoringFixtures.toString()})();`
