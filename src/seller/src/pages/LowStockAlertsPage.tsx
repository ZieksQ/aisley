import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuRefreshCw, LuSearch } from 'react-icons/lu'
import {
  IconButton,
  PortalField,
  PortalPagination,
  PortalState,
  PortalSkeleton,
  PortalTable,
} from '@aisley/ui/portal'
import { useSellerRead } from '../lib/useSellerRead'
import { dateTime } from '../features/inventory/model'
import type { LowStockAlertPage } from '../types/operations'
import '../features/inventory/alerts.css'

export function LowStockAlertsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const filters = new URLSearchParams({ page: String(page) })
  if (query) filters.set('search', query)
  if (status) filters.set('state', status)
  if (from) filters.set('from', from)
  if (to) filters.set('to', to)
  const state = useSellerRead<LowStockAlertPage>(
    `/api/v1/seller/low-stock-alerts?${filters}`,
  )
  useEffect(() => {
    document.title = 'Low-stock alerts | Aisley Seller'
  }, [])

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Low-stock alerts</h2>
          <p className="portal-page-description">
            Review threshold crossings and stock recovery. Alerts never change
            your stock balance.
          </p>
        </div>
        <div className="portal-inline-actions">
          <Link className="portal-button" to="/inventory">
            Open inventory
          </Link>
          <IconButton
            label="Refresh alerts"
            disabled={state.loading}
            onClick={state.refresh}
          >
            <LuRefreshCw aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      <form
        className="portal-filter-bar alert-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(search.trim())
          setPage(1)
        }}
      >
        <PortalField
          label="Search product or SKU"
          id="alert-search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="portal-field">
          <label htmlFor="alert-state">Alert state</label>
          <select
            id="alert-state"
            className="portal-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All alerts</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <PortalField
          label="From date"
          id="alert-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => {
            setFrom(event.target.value)
            setPage(1)
          }}
        />
        <PortalField
          label="To date"
          id="alert-to"
          type="date"
          min={from || undefined}
          value={to}
          onChange={(event) => {
            setTo(event.target.value)
            setPage(1)
          }}
        />
        <button className="portal-button" type="submit">
          <LuSearch aria-hidden="true" />
          Search
        </button>
      </form>
      {state.error ? (
        <PortalState
          error
          title={state.error}
          action={
            <button className="portal-button" onClick={state.refresh}>
              Try again
            </button>
          }
        />
      ) : state.loading ? (
        <PortalSkeleton label="Loading alerts…" />
      ) : !state.data?.data.length ? (
        <PortalState
          title={
            state.data?.configured_threshold_count === 0
              ? 'No alert thresholds configured'
              : 'No alerts match this view'
          }
          description={
            state.data?.configured_threshold_count === 0
              ? 'Set a threshold on an inventory SKU to start monitoring available stock.'
              : 'Try another filter or return when a threshold crossing is recorded.'
          }
          action={
            state.data?.configured_threshold_count === 0 ? (
              <Link className="portal-button" to="/inventory">
                Open inventory
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <PortalTable label="Low-stock alert history">
            <caption>
              {state.data.total} alerts ·{' '}
              {state.data.configured_threshold_count} configured thresholds ·
              Asia/Manila
            </caption>
            <thead>
              <tr>
                <th scope="col">Product / SKU</th>
                <th scope="col">State</th>
                <th className="portal-number" scope="col">
                  Latest available
                </th>
                <th className="portal-number" scope="col">
                  Threshold
                </th>
                <th scope="col">Triggered</th>
              </tr>
            </thead>
            <tbody>
              {state.data.data.map((alert) => (
                <tr key={alert.id}>
                  <td className="portal-table-name">
                    <Link
                      className="portal-link font-medium"
                      to={`/low-stock-alerts/${alert.id}`}
                    >
                      {alert.product.name}
                    </Link>
                    <span className="portal-table-meta font-mono">
                      {alert.sku.code}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`portal-tag portal-tag-${alert.state === 'active' ? 'warning' : 'success'}`}
                    >
                      {alert.state === 'active' ? 'Active' : 'Resolved'}
                    </span>
                  </td>
                  <td className="portal-number font-semibold">
                    {alert.current_available}
                  </td>
                  <td className="portal-number">
                    {alert.current_threshold ?? 'Off'}
                  </td>
                  <td className="whitespace-nowrap">
                    {dateTime(alert.triggered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </PortalTable>
          <PortalPagination
            page={state.data.current_page}
            lastPage={state.data.last_page}
            total={state.data.total}
            onPage={setPage}
          />
        </>
      )}
    </main>
  )
}
