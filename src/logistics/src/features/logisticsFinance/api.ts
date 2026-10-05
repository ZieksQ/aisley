import { csrf, request } from '../../lib/api'

export type Balance = { courier_id: string; courier_name: string; currency: string; outstanding_cents: number; order_count: number }
export type Obligation = {
  id: string;
  order_reference: string;
  courier_id: string;
  courier_name: string;
  currency: string;
  amount_cents: number;
  delivered_at: string
}
export type CashReceipt = {
  id: string;
  courier_name: string;
  currency: string;
  total_cents: number;
  received_at: string;
  simulation_credit: 'credited' | 'pending';
  orders: { reference: string; amount_cents: number }[]
}
export type CashPage = { data: Obligation[]; balances: Balance[]; meta: { last_page: number; total: number } }
export type ReceiptPage = { data: CashReceipt[]; meta: { last_page: number; total: number } }
export type CashAttempt = { obligation_ids: string[]; confirmed: true; idempotency_key: string; selection: Obligation[] }
export type Billing = { label: string; masked_identifier: string; currency: string; active: boolean; simulation_enabled: boolean }

export function cashBalances(page: number, courier: string, currency: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), per_page: '20' })
  if (courier) params.set('courier_id', courier)
  if (currency) params.set('currency', currency)
  return request<CashPage>(`/api/v1/logistics/finance/courier-cash?${params}`, { signal })
}
export function cashReceipts(page: number, signal?: AbortSignal) {
  return request<ReceiptPage>(`/api/v1/logistics/finance/courier-cash/receipts?page=${page}`, { signal })
}
export async function receiveCash(attempt: CashAttempt) {
  await csrf()
  const { obligation_ids, confirmed, idempotency_key } = attempt
  return request<{ data: CashReceipt }>('/api/v1/logistics/finance/courier-cash/receipts', { method: 'POST', body: JSON.stringify({ obligation_ids, confirmed, idempotency_key }) })
}
export function billingAccount(signal?: AbortSignal) {
  return request<{ data: Billing }>('/api/v1/logistics/finance/billing', { signal })
}
