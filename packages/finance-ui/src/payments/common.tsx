import { Button as SharedButton, type ButtonProps } from '@aisley/ui'
import type { ReactNode } from 'react'
import type { Attempt, Page } from './types'
import '../theme.css'
import './payments.css'
export const money = (amount: number, currency = 'PHP') => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount / 100)
export const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : '—'
export const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  return <SharedButton {...props} variant={variant} className={`payment-button payment-button--${variant} ${className}`} />
}
export function PaymentShell({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode
}) {
  return <section className="finance-workspace finance-payments">
    <header className="payment-page-header">
      <div>
        <h2>{title}</h2>
        {description && <p className="payment-muted">{description}</p>}
      </div>
      {actions && <div className="payment-header-actions">{actions}</div>}
    </header>
    <div className="payment-page-content">{children}</div>
  </section>
}
export function PaymentSection({ title, description, actions, children }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode
}) {
  return <section className="payment-section">
    <div className="payment-section-header">
      <div>
        <h3>{title}</h3>
        {description && <p className="payment-muted">{description}</p>}
      </div>
      {actions && <div className="payment-header-actions">{actions}</div>}
    </div>
    {children}
  </section>
}
export function StatusText({ value }: { value: string }) {
  const tone = ['paid', 'cleared', 'succeeded', 'active', 'ready'].includes(value) ? 'success'
    : ['failed', 'rejected', 'overdue', 'review'].includes(value) ? 'attention' : 'neutral'
  return <span className={`payment-status payment-status--${tone}`}>{label(value)}</span>
}
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="payment-empty">
    <p>{title}</p>
    {description && <p className="payment-muted">{description}</p>}
  </div>
}
export function PaymentTable({ caption, children }: { caption: string; children: ReactNode }) {
  return <div className="payment-table" role="region" aria-label={caption} tabIndex={0}>
    <table>
      <caption className="payment-sr-only">{caption}</caption>
      {children}
    </table>
  </div>
}
export function Feedback({ loading, error, message, retry }: {
  loading?: boolean; error?: string; message?: string; retry?: () => void
}) {
  return <>
    {loading && <div role="status" className="payment-loading">
      <span aria-hidden="true" className="payment-loading-mark" />Loading…
    </div>}
    {error && <div role="alert" className="payment-feedback payment-error">
      <p>{error}</p>
      {retry && <Button variant="outline" onClick={retry}>Retry</Button>}
    </div>}
    {message && <p role="status" className="payment-feedback payment-success">{message}</p>}
  </>
}
export function Paging<T>({ page, value, change }: { page: Page<T> | null; value: number; change: (page: number) => void }) {
  const last = page?.meta?.last_page ?? page?.last_page ?? 1
  const total = page?.meta?.total ?? page?.total ?? 0
  return <nav className="payment-pagination" aria-label="Table pagination">
    <p className="payment-muted">{total} {total === 1 ? 'result' : 'results'} · Page {value} of {last}</p>
    <div className="payment-header-actions">
      <Button variant="outline" disabled={value <= 1} onClick={() => change(value - 1)}>Previous</Button>
      <Button variant="outline" disabled={value >= last} onClick={() => change(value + 1)}>Next</Button>
    </div>
  </nav>
}
export function Attempts({ attempts }: { attempts: Attempt[] }) {
  return <PaymentSection title="Payment attempts">
    {attempts.length === 0 ? <EmptyState title="No gateway payment attempts." /> : <ul className="payment-list">
      {attempts.map((attempt) => <li key={attempt.id}>
        <div className="payment-row-heading">
          <StatusText value={attempt.status} />
          <strong className="payment-amount">{money(attempt.amount_cents, attempt.currency)}</strong>
        </div>
        <p className="payment-muted">{date(attempt.created_at)}</p>
        <p className="payment-reference">{attempt.provider_reference ?? 'Awaiting gateway reference'}</p>
        {attempt.failure_code && <p className="payment-attention">{label(attempt.failure_code)}</p>}
        {attempt.status === 'unknown' && <p className="payment-notice">Payment outcome is being checked. These funds remain reserved.</p>}
      </li>)}
    </ul>}
  </PaymentSection>
}
