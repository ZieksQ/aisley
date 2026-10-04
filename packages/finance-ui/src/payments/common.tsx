import { Button } from '@aisley/ui'
import type { ReactNode } from 'react'
import type { Attempt, Page } from './types'
import '../theme.css'
import './payments.css'

export const money = (amount: number, currency = 'PHP') => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount / 100)
export const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : '—'
export function PaymentShell({ title, children }: { title: string; children: ReactNode }) {
  return <section className="finance-workspace finance-payments">
    <h2>
      {title}
    </h2>
    {children}
  </section>
}
export function Feedback({ loading, error, message, retry }: { loading?: boolean; error?: string; message?: string; retry?: () => void }) {
  return <>{loading && <p role="status">
    Loading…
  </p>}{error && <div role="alert" className="payment-error">
    <p>
      {error}
    </p>
    {retry && <Button variant="outline" onClick={retry}>
      Retry
    </Button>}
  </div>}{message && <p role="status">
    {message}
  </p>}</>
}
export function Paging<T>({ page, value, change }: { page: Page<T> | null; value: number; change: (page: number) => void }) {
  const last = page?.meta?.last_page ?? page?.last_page ?? 1
  return <div className="payment-toolbar">
    <Button variant="outline" disabled={value <= 1} onClick={() => change(value - 1)}>
      Previous
    </Button>
    <span>
      Page
      {value}
      of
      {last}
    </span>
    <Button variant="outline" disabled={value >= last} onClick={() => change(value + 1)}>
      Next
    </Button>
  </div>
}
export function Attempts({ attempts }: { attempts: Attempt[] }) {
  return <div>
    <h3>
      Payment attempts
    </h3>
    {attempts.length === 0 ? <p>
      No gateway payment attempts.
    </p> : <ul className="payment-list">
      {attempts.map((attempt) => <li key={attempt.id}>
        <strong>
          {attempt.status.replaceAll('_', ' ')}
          ·
          {money(attempt.amount_cents, attempt.currency)}
        </strong>
        <p>
          {date(attempt.created_at)}
          ·
          {attempt.provider_reference ?? 'Awaiting gateway reference'}
        </p>
        {attempt.failure_code && <p>
          {attempt.failure_code.replaceAll('_', ' ')}
        </p>}
        {attempt.status === 'unknown' && <p>
          Payment outcome is being checked. These funds remain reserved.
        </p>}
      </li>)}
    </ul>}
  </div>
}
