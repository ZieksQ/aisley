import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import {
  IconButton,
  PortalSection,
  PortalState,
  PortalSkeleton,
} from '@aisley/ui/portal'
import { useSellerRead } from '../lib/useSellerRead'
import { dateTime, label } from '../features/inventory/model'
import type { LowStockAlert } from '../types/operations'
import '../features/inventory/alerts.css'

export function LowStockAlertDetailPage() {
  const { alertId } = useParams()
  const state = useSellerRead<{ data: LowStockAlert }>(
    `/api/v1/seller/low-stock-alerts/${encodeURIComponent(alertId ?? '')}`,
  )
  const alert = state.data?.data
  useEffect(() => {
    document.title = 'Low-stock alert | Aisley Seller'
  }, [])
  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <Link
            className="portal-link portal-inline-actions mb-4 text-sm"
            to="/low-stock-alerts"
          >
            <LuArrowLeft aria-hidden="true" />
            Low-stock alerts
          </Link>
          <h2 className="portal-page-heading">
            {alert?.product.name ?? 'Alert details'}
          </h2>
          {alert && (
            <p className="portal-page-description font-mono">
              {alert.sku.code}
            </p>
          )}
        </div>
        <div className="portal-inline-actions">
          {alert && (
            <Link
              className="portal-button portal-button-primary"
              to={alert.inventory_destination}
            >
              Open SKU inventory
            </Link>
          )}
          <IconButton
            label="Refresh alert"
            disabled={state.loading}
            onClick={state.refresh}
          >
            <LuRefreshCw aria-hidden="true" />
          </IconButton>
        </div>
      </header>
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
      ) : !alert ? (
        <PortalSkeleton label="Loading alert…" rows={3} />
      ) : (
        <div className="portal-form-stack">
          <p className="portal-feedback">
            <span
              className={`portal-tag portal-tag-${alert.state === 'active' ? 'warning' : 'success'}`}
            >
              {alert.state === 'active' ? 'Active alert' : 'Resolved'}
            </span>
            <span className="ml-3">
              {alert.state === 'active'
                ? 'Available stock crossed the configured threshold.'
                : alert.resolution_reason === 'threshold_disabled'
                  ? 'The threshold was disabled. This alert remains in history.'
                  : 'Stock recovered above the threshold. This alert remains in history.'}
            </span>
          </p>
          <dl className="portal-data-strip alert-data-strip">
            {[
              ['Latest available', alert.current_available],
              ['Latest threshold', alert.current_threshold ?? 'Off'],
              ['Available at trigger', alert.trigger_available],
              ['Threshold at trigger', alert.trigger_threshold],
            ].map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <PortalSection
            id="alert-timeline"
            title="Alert record"
            description="Snapshots belong to this alert cycle. Open Inventory for the current stock balance."
          >
            <dl className="portal-definition-list">
              <div>
                <dt>Triggered · Asia/Manila</dt>
                <dd>{dateTime(alert.triggered_at)}</dd>
              </div>
              <div>
                <dt>Resolved · Asia/Manila</dt>
                <dd>
                  {alert.resolved_at
                    ? dateTime(alert.resolved_at)
                    : 'Not resolved'}
                </dd>
              </div>
              <div>
                <dt>Resolution reason</dt>
                <dd>
                  {alert.resolution_reason
                    ? label(alert.resolution_reason)
                    : 'Not resolved'}
                </dd>
              </div>
              <div>
                <dt>Source movement</dt>
                <dd>
                  {alert.trigger_movement
                    ? label(alert.trigger_movement.type)
                    : 'Threshold evaluation'}
                </dd>
              </div>
            </dl>
          </PortalSection>
        </div>
      )}
    </main>
  )
}
