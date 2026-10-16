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
import { StockState } from '../features/inventory/StockState'
import { variantLabel } from '../features/inventory/model'
import type { InventorySku, Page } from '../types/operations'

export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [stock, setStock] = useState('')
  const [page, setPage] = useState(1)
  const filters = new URLSearchParams({ page: String(page) })
  if (query) filters.set('search', query)
  if (stock) filters.set('stock', stock)
  const state = useSellerRead<Page<InventorySku>>(
    `/api/v1/seller/inventory?${filters}`,
  )
  useEffect(() => {
    document.title = 'Inventory | Aisley Seller'
  }, [])

  return (
    <main className="portal-page">
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Inventory</h2>
          <p className="portal-page-description">
            Track physical stock, reserved units and what’s available to sell.
          </p>
        </div>
        <div className="portal-inline-actions">
          <Link className="portal-button" to="/low-stock-alerts">
            Low-stock alerts
          </Link>
          <IconButton
            label="Refresh inventory"
            disabled={state.loading}
            onClick={state.refresh}
          >
            <LuRefreshCw aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      <form
        className="portal-filter-bar"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(search.trim())
          setPage(1)
        }}
      >
        <PortalField
          label="Search product or SKU"
          id="inventory-search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="portal-field">
          <label htmlFor="inventory-stock">Stock state</label>
          <select
            className="portal-input"
            id="inventory-stock"
            value={stock}
            onChange={(event) => {
              setStock(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
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
        <PortalSkeleton label="Loading inventory…" />
      ) : !state.data?.data.length ? (
        <PortalState
          title="No inventory matches this view"
          description="Try a different product name, SKU or stock filter."
        />
      ) : (
        <>
          <PortalTable label="Shop inventory">
            <caption>
              {state.data.total} SKUs · Available = on hand − reserved
            </caption>
            <thead>
              <tr>
                <th scope="col">Product / SKU</th>
                <th className="portal-number" scope="col">
                  On hand
                </th>
                <th className="portal-number" scope="col">
                  Reserved
                </th>
                <th className="portal-number" scope="col">
                  Available
                </th>
                <th className="portal-number" scope="col">
                  Threshold
                </th>
                <th scope="col">Stock state</th>
              </tr>
            </thead>
            <tbody>
              {state.data.data.map((sku) => (
                <tr key={sku.id}>
                  <td className="portal-table-name">
                    <Link
                      className="portal-link font-medium"
                      to={`/inventory/${sku.id}`}
                    >
                      {sku.product.name}
                    </Link>
                    {sku.variant && (
                      <span className="portal-table-meta">
                        {variantLabel(sku.variant)}
                      </span>
                    )}
                    <span className="portal-table-meta font-mono">
                      {sku.code}
                    </span>
                    {sku.status === 'inactive' ||
                    sku.product.status === 'archived' ? (
                      <span className="portal-table-meta">
                        {sku.product.status === 'archived'
                          ? 'Archived product'
                          : 'Inactive SKU'}
                      </span>
                    ) : null}
                  </td>
                  <td className="portal-number">{sku.on_hand}</td>
                  <td className="portal-number">{sku.reserved}</td>
                  <td className="portal-number font-semibold">
                    {sku.available}
                  </td>
                  <td className="portal-number">
                    {sku.alert_threshold ?? 'Off'}
                  </td>
                  <td>
                    <StockState state={sku.stock_state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </PortalTable>
          <PortalPagination
            page={state.data.current_page}
            lastPage={state.data.last_page}
            total={state.data.total}
            disabled={state.loading}
            onPage={setPage}
          />
        </>
      )}
    </main>
  )
}
