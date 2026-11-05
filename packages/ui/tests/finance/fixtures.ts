import { useEffect, useState } from 'react'
import { manilaToday } from '../../src/date-range/period'

const initial = new URLSearchParams(location.search)
export const fixture = window.fixture = { role: initial.get('role') ?? 'admin', account: 'first', permissions: ['finance.view', 'finance.manage'], mode: 'normal', delay: 0, reads: [] as string[], writes: [] as { path: string; body: unknown }[], revision: Math.random(), downloads: [] as string[], downloadError: false, writeMode: 'normal' }
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, options) => {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (path.includes('/api/') && (/ledger\.csv|\/pdf$|\/receipt$/.test(path))) {
    fixture.downloads.push(path)
    return fixture.downloadError ? new Response('Unavailable', { status: 503 }) : new Response(path.includes('csv') ? 'effective_at,event_type\n2026-11-01,test' : '%PDF-1.4\nsynthetic', { headers: { 'Content-Type': path.includes('csv') ? 'text/csv' : 'application/pdf' } })
  }
  return originalFetch(input, options)
}
export function useAuth() {
  const [, render] = useState(0)
  useEffect(() => { const change = () => render((value) => value + 1); window.addEventListener('fixture-account', change); return () => window.removeEventListener('fixture-account', change) }, [])
  const user = { id: fixture.account, permissions: fixture.permissions, organization: { id: fixture.account }, shop: { id: fixture.account } }
  return { admin: user, logistics: user, seller: user }
}
export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
export const apiUrl = (path: string) => path
export const apiAssetUrl = apiUrl
export const csrf = async () => {}
const today = manilaToday()
const period = (url: URL) => ({ dateFrom: url.searchParams.get('date_from'), dateTo: url.searchParams.get('date_to'), allTime: url.searchParams.get('all_time') === '1' })
const policy = { cod_deadline_hours: 72, seller_delay_hours: 336, logistics_delay_hours: 24, collection_time: '09:00', seller_payout_time: '09:00', logistics_payout_time: '09:00', collection_enabled: true, seller_payout_enabled: true, logistics_payout_enabled: true }
const page = (data: unknown[], current = 1) => ({ data, current_page: current, last_page: 2, total: 30, meta: { current_page: current, last_page: 2, total: 30 } })
const batch = { id: 'batch-1', collector_name: 'Metro Delivery', reference: 'REM-0001', status: 'submitted', currency: 'PHP', total_cents: 120000, is_gateway: false, submitted_at: `${today}T02:00:00Z`, cleared_at: null, rejection_reason: null, allocations: [{ order_id: 'order-1', order_reference: 'AIS-0001', amount_cents: 120000 }], attempts: [] }
const invoice = { id: 'invoice-1', reference: 'INV-0001', order_id: 'order-1', order_reference: 'AIS-0001', logistics_organization_id: 'first', collector_name: 'Metro Delivery', status: 'outstanding', overdue: false, currency: 'PHP', total_cents: 120000, remaining_cents: 120000, delivered_at: `${today}T02:00:00Z`, due_at: `${today}T23:00:00Z`, seller_eligible_at: `${today}T23:00:00Z`, logistics_eligible_at: `${today}T23:00:00Z`, paid_at: null, review_reason: null }
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, location.origin)
  fixture.reads.push(path)
  const mode = fixture.mode
  const account = fixture.account
  const wait = fixture.delay
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (mode === 'error') throw new ApiError(503, 'Finance temporarily unavailable')
  if (mode === 'denied') throw new ApiError(403, 'Finance access denied')
  if (options.method && options.method !== 'GET') {
    fixture.writes.push({ path, body: options.body ? JSON.parse(String(options.body)) : null })
    if (fixture.writeMode === 'unknown') throw new ApiError(503, 'Payment response uncertain. Retry the same selection.')
    return { data: { id: 'saved', cod_remittance_batch_id: null, simulation_credit: 'credited' } } as T
  }
  const empty = mode === 'empty'
  const selected = period(url)
  const end = selected.dateTo ?? today
  const start = selected.dateFrom ?? today
  const days = Math.max(1, Math.min(5, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1))
  const amount = account === 'second' ? 990000 : end === today ? 1240000 : 720000
  let data: unknown
  if (url.pathname.endsWith('/summary')) data = { data: {
    period: selected, currency: 'PHP', timezone: 'Asia/Manila', generatedAt: new Date().toISOString(),
    summary: { revenueCents: empty ? 0 : amount, costsCents: empty ? 0 : 320000, profitCents: empty ? 0 : amount - 320000, availableBalanceCents: 2850000, profitState: 'provisional' },
    series: Array.from({ length: days }, (_, index) => ({ date: new Date(new Date(`${end}T00:00:00Z`).getTime() - (days - 1 - index) * 86400000).toISOString().slice(0, 10), actualRevenueCents: empty ? 0 : [160000, 250000, 180000, 310000, 340000][index], actualProfitCents: 100000 })),
    waterfall: [{ label: 'Revenue', amountCents: empty ? 0 : amount }, { label: 'Costs', amountCents: empty ? 0 : -320000 }, { label: 'Operating profit', amountCents: empty ? 0 : amount - 320000 }],
    revenueBreakdown: empty ? [] : [{ label: 'Commission revenue', amountCents: amount }],
    remittanceAging: { submittedCents: 120000, clearedCents: 400000, oldestSubmittedAt: null },
    payoutSchedule: empty ? [] : [{ id: 'payout-1', amountCents: 450000, currency: 'PHP', status: 'pending', eligibleThrough: `${today}T00:00:00Z`, isSandbox: true }],
    forecast: { state: 'insufficient_history', usableWeeks: 3, requiredWeeks: 8, profitSuppressed: true, series: [], scenarios: [] },
    moneyFlow: { nodes: [{ id: 'customer', label: 'Customer COD' }, { id: 'platform', label: 'Aisley clearing' }], edges: [{ id: 'cod', source: 'customer', target: 'platform', label: 'Full COD remittance' }], scope: fixture.role },
  } }
  else if (url.pathname.endsWith('/ledger')) data = page(empty ? [] : [{ id: 'journal-1', effective_at: `${end}T02:00:00Z`, event_type: 'delivery_recognized', memo: null, currency: 'PHP', order: { id: 'order-1', reference: 'AIS-0001' }, lines: [{ id: 'line-1', account_code: 'commission_revenue', debit_cents: 0, credit_cents: 1240000 }] }], Number(url.searchParams.get('page') ?? 1))
  else if (url.pathname.endsWith('/payout-obligations')) data = page(empty ? [] : [{ order_id: 'order-1', order_reference: 'AIS-0001', beneficiary_type: 'logistics', beneficiary_id: 'first', beneficiary_name: 'Metro Delivery', currency: 'PHP', amount_cents: 450000, eligible_at: `${today}T00:00:00Z`, blocked: [] }])
  else if (url.pathname.endsWith('/payout-history')) data = page(empty ? [] : [{ id: 'payout-1', beneficiary_name: 'Metro Delivery', beneficiary_type: 'logistics', beneficiary_id: 'first', status: 'succeeded', amount_cents: 450000, currency: 'PHP', provider_reference: 'SIM-0001', submitted_at: `${end}T00:00:00Z`, resolved_at: `${end}T01:00:00Z`, attempts: [], is_sandbox: true }])
  else if (url.pathname.endsWith('/automation')) data = { data: { platform: policy, collection: policy, timezone: 'Asia/Manila', next_collection_at: `${today}T01:00:00Z`, gateway_enabled: true, can_manage: fixture.role !== 'seller' } }
  else if (url.pathname.endsWith('/invoices/invoice-1')) data = { data: invoice, batches: [batch] }
  else if (url.pathname.endsWith('/invoices')) data = { ...page(empty ? [] : [invoice]), summary: { currency: 'PHP', outstanding_cents: 120000, overdue_cents: 0 } }
  else if (url.pathname.endsWith('/remittances/batch-1')) data = { data: batch }
  else if (url.pathname.endsWith('/remittances')) data = page(empty ? [] : [batch])
  else if (url.pathname.endsWith('/holds/hold-1')) data = { data: { id: 'hold-1', is_open: !fixture.writes.some(write => write.path.includes('reconcile-logistics')), reason_code: 'LOGISTICS_EVIDENCE_MISSING', reason_label: 'Logistics evidence missing', notes: 'Review carrier evidence.', placed_at: `${today}T00:00:00Z`, released_at: null, order: { id: 'order-1', reference: 'AIS-0001', shop_name: 'Metro Shop', currency: 'PHP', selected_logistics_organization: { id: 'first', business_name: 'Metro Delivery' } }, pricing: { pricing_model: 'logistics_service_base_v1', route_status: 'unplanned', logistics_pool_cents: 9000, quoted_shipping_fee_cents: 10000, base_fee_cents: 9000, additional_weight_fee_cents: 0, destination_surcharge_cents: 1000, billable_weight_grams: 2000, destination: { city_municipality: 'Makati City', province: 'Metro Manila', region: 'NCR' } }, reconciliation: null }, organizations: [{ id: 'first', business_name: 'Metro Delivery', hub_name: 'Metro Hub' }] }
  else if (url.pathname.endsWith('/holds')) data = page(empty ? [] : [{ id: 'hold-1', reason_code: 'LOGISTICS_EVIDENCE_MISSING', reason_label: 'Logistics evidence missing', placed_at: `${today}T00:00:00Z`, released_at: null, order: { id: 'order-1', reference: 'AIS-0001', shop_name: 'Metro Shop', currency: 'PHP' }, pricing: { logistics_pool_cents: 9000, destination: { city_municipality: 'Makati City' } } }])
  else if (url.pathname.endsWith('/sandbox')) data = { accounts: [{ id: 'account-1', reference: 'logistics-first', balance_cents: 100000, scenario: 'success', is_active: true }], transactions: page([]), events: [], organizations: [{ id: 'first', business_name: 'Metro Delivery' }] }
  else if (url.pathname.endsWith('/courier-cash/receipts')) data = page(empty ? [] : [{ id: 'receipt-1', courier_name: 'Test Courier', currency: 'PHP', total_cents: 120000, received_at: `${today}T00:00:00Z`, simulation_credit: 'credited', orders: [{ reference: 'AIS-0001', amount_cents: 120000 }] }])
  else if (url.pathname.endsWith('/courier-cash')) data = { ...page(empty ? [] : [{ id: 'cash-1', order_reference: 'AIS-0001', courier_id: 'courier-1', courier_name: 'Test Courier', currency: 'PHP', amount_cents: 120000, delivered_at: `${today}T00:00:00Z` }]), balances: [{ courier_id: 'courier-1', courier_name: 'Test Courier', currency: 'PHP', outstanding_cents: 120000, order_count: 1 }] }
  else throw new Error(`Unhandled Finance fixture: ${path}`)
  return data as T
}
export const request = apiRequest
