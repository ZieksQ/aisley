import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LuArrowLeft, LuRefreshCw } from 'react-icons/lu'
import {
  IconButton,
  PortalPagination,
  PortalSection,
  PortalState,
  PortalSkeleton,
  PortalTable,
} from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { useSellerRead } from '../lib/useSellerRead'
import { InventoryForms } from '../features/inventory/InventoryForms'
import { StockState } from '../features/inventory/StockState'
import {
  dateTime,
  label,
  signed,
  variantLabel,
  type Movement,
} from '../features/inventory/model'
import type { InventorySku, Page } from '../types/operations'

export function InventoryDetailPage() {
  const { skuId } = useParams()
  return <InventoryDetailWorkspace key={skuId} skuId={skuId ?? ''} />
}

function InventoryDetailWorkspace({ skuId }: { skuId: string }) {
  const { seller } = useAuth()
  const [page, setPage] = useState(1)
  const [guarded, setGuarded] = useState(false)
  const item = useSellerRead<{ data: InventorySku }>(
    `/api/v1/seller/inventory/${encodeURIComponent(skuId ?? '')}`,
  )
  const history = useSellerRead<Page<Movement>>(
    `/api/v1/seller/inventory/${encodeURIComponent(skuId ?? '')}/movements?page=${page}`,
  )
  useEffect(() => {
    document.title = 'SKU inventory | Aisley Seller'
  }, [])
  const sku = item.data?.data
  const canAdjust =
    sku?.status === 'active' && sku.product.status !== 'archived'
  function refresh() {
    item.refresh()
    history.refresh()
  }

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <Link
            className="portal-link portal-inline-actions mb-4 text-sm"
            to="/inventory"
          >
            <LuArrowLeft aria-hidden="true" />
            Inventory
          </Link>
          <h2 className="portal-page-heading">
            {sku?.product.name ?? 'SKU inventory'}
          </h2>
          {sku && (
            <>
              <p className="portal-page-description">
                {variantLabel(sku.variant) || 'Base SKU'}
                <span className="portal-table-meta font-mono">{sku.code}</span>
              </p>
              <div className="portal-inline-actions mt-3">
                <StockState state={sku.stock_state} />
                {sku.product.status === 'archived' && (
                  <span className="portal-tag">Archived product</span>
                )}
                {sku.status === 'inactive' && (
                  <span className="portal-tag">Inactive SKU</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="portal-inline-actions">
          {sku && (
            <>
              {canAdjust && (
                <a
                  className="portal-button portal-button-primary"
                  href="#adjust-stock"
                >
                  Adjust stock
                </a>
              )}
              <a
                className={`portal-button${canAdjust ? '' : ' portal-button-primary'}`}
                href="#stock-threshold"
              >
                Alert threshold
              </a>
            </>
          )}
          <IconButton
            label="Refresh inventory detail"
            disabled={item.loading || history.loading || guarded}
            onClick={refresh}
          >
            <LuRefreshCw aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      {item.error && (
        <div className="mb-6">
          <PortalState
            error
            title={item.error}
            description={
              sku
                ? 'The last loaded stock is shown. Your unsaved input is preserved.'
                : undefined
            }
            action={
              <button
                className="portal-button"
                disabled={guarded}
                onClick={item.refresh}
              >
                Try again
              </button>
            }
          />
        </div>
      )}
      {!sku ? (
        !item.error && <PortalSkeleton label="Loading inventory…" rows={3} />
      ) : (
        <>
          <dl className="portal-data-strip">
            {[
              ['On hand', sku.on_hand],
              ['Reserved', sku.reserved],
              ['Available', sku.available],
            ].map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="portal-detail-grid">
            <div className="portal-form-stack">
              <PortalSection
                id="movement-history"
                title="Movement history"
                description="An immutable record of stock changes. Times shown in Asia/Manila."
              >
                {history.error ? (
                  <PortalState
                    error
                    title={history.error}
                    action={
                      <button
                        className="portal-button"
                        onClick={history.refresh}
                      >
                        Try again
                      </button>
                    }
                  />
                ) : history.loading ? (
                  <PortalState title="Loading movements…" />
                ) : !history.data?.data.length ? (
                  <PortalState
                    title="No movements yet"
                    description="Recorded adjustments and Order stock changes will appear here."
                  />
                ) : (
                  <>
                    <PortalTable label="Inventory movement history">
                      <thead>
                        <tr>
                          <th scope="col">Movement</th>
                          <th className="portal-number" scope="col">
                            On hand Δ
                          </th>
                          <th className="portal-number" scope="col">
                            Reserved Δ
                          </th>
                          <th className="portal-number" scope="col">
                            Balance after
                          </th>
                          <th scope="col">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.data.data.map((movement) => (
                          <tr key={movement.id}>
                            <td className="portal-table-name">
                              <strong className="font-medium">
                                {label(movement.movement_type)}
                              </strong>
                              <span className="portal-table-meta">
                                {movement.reason || 'System stock movement'}
                              </span>
                              {movement.reference_id && (
                                <span className="portal-table-meta">
                                  {label(
                                    movement.reference_type ?? 'Reference',
                                  )}{' '}
                                  · {movement.reference_id}
                                </span>
                              )}
                            </td>
                            <td className="portal-number">
                              {signed(movement.on_hand_delta)}
                            </td>
                            <td className="portal-number">
                              {signed(movement.reserved_delta ?? 0)}
                            </td>
                            <td className="portal-number">
                              {movement.resulting_on_hand} on hand
                              <span className="portal-table-meta">
                                {movement.resulting_reserved} reserved
                              </span>
                            </td>
                            <td className="whitespace-nowrap">
                              {dateTime(movement.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </PortalTable>
                    <PortalPagination
                      page={history.data.current_page}
                      lastPage={history.data.last_page}
                      total={history.data.total}
                      onPage={setPage}
                    />
                  </>
                )}
              </PortalSection>
            </div>
            <InventoryForms
              key={`${seller?.id}:${sku.id}`}
              sku={sku}
              onCommitted={refresh}
              onGuardChange={setGuarded}
              onAccessLost={() => {
                item.clear()
                history.clear()
                setGuarded(false)
              }}
            />
          </div>
        </>
      )}
    </main>
  )
}
