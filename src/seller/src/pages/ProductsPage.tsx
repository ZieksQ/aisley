import { useEffect, useState } from 'react'
import { ConfirmationDialog, IconButton } from '@aisley/ui/portal'
import { FaArrowLeft, FaArrowRight, FaBoxOpen, FaMagnifyingGlass, FaPlus, FaRotateRight } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ProductTable } from '../components/products/ProductTable'
import { ApiError } from '../lib/api'
import { listProducts, transitionProduct } from '../lib/products'
import type { Page, Product } from '../types/operations'
import '../components/products/products.css'
const statuses = [{ value: '', label: 'All products' }, { value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]
type PendingAction = { product: Product; action: 'archive' | 'unarchive' }
export function ProductsPage() {
  const [page, setPage] = useState<Page<Product> | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  useEffect(() => {
    document.title = 'Products | Aisley Seller'
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const query = new URLSearchParams({
      page: String(pageNumber),
      ...(search ? { search } : {}),
      ...(status ? { status } : {})
    })
    listProducts(query, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPage(result)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setPage(null)
        setError(cause instanceof ApiError ? cause.message : 'Unable to load products.')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [reload, search, status, pageNumber])
  async function transition(product: Product, action: 'publish' | 'archive' | 'unarchive') {
    if (busyId) return
    setBusyId(product.id)
    setError('')
    try {
      await transitionProduct(product.id, action)
      setPending(null)
      setReload((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof ApiError ? Object.values(cause.errors)[0]?.[0] ?? cause.message : `Unable to ${action} this product.`)
    } finally {
      setBusyId(null)
    }
  }
  return (
    <div className="portal-page product-workspace">
      <header className="product-page-header">
        <div>
          <h2 className="portal-page-heading">
            Products
          </h2>
          <p>
            Create drafts, maintain listings, and control publication.
          </p>
        </div>
        <Link className="portal-button portal-button-primary" to="/products/new">
          <FaPlus aria-hidden="true" />
          Add product
        </Link>
      </header>
      <section className="product-catalog" aria-label="Product catalog">
        <div className="product-catalog-toolbar">
          <div
            className="product-status-filters"
            role="group"
            aria-label="Product status">
            {statuses.map((item) => <button
              key={item.value}
              aria-pressed={status === item.value}
              onClick={() => {
                setStatus(item.value)
                setPageNumber(1)
              }}>
              {item.label}
            </button>)}
          </div>
          <div className="product-search">
            <FaMagnifyingGlass aria-hidden="true" />
            <input
              aria-label="Search products"
              placeholder="Search products…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPageNumber(1)
              }} />
          </div>
        </div>
        <div className="product-catalog-caption">
          <p aria-live="polite">
            {loading ? 'Loading products…' : page ? `${page.total.toLocaleString()} ${page.total === 1 ? 'product' : 'products'}${search || status ? ' in this view' : ''}` : 'Products unavailable'}
          </p>
          <IconButton
            label="Refresh products"
            disabled={loading || Boolean(busyId)}
            onClick={() => setReload((value) => value + 1)}>
            <FaRotateRight aria-hidden="true" />
          </IconButton>
        </div>
        {error && !pending && <div className="product-error" role="alert">
          <span>
            {error}
          </span>
          <button className="portal-button" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </div>}
        {loading ? <div
          className="product-table-skeleton"
          role="status"
          aria-label="Loading products">
          {Array.from({ length: 5 }, (_, index) => <div className="product-skeleton-row" key={index}>
            <span />
            <div>
              <span />
              <span />
            </div>
            <span />
            <span />
          </div>)}
        </div>
          : page?.data.length ? <ProductTable
            products={page.data}
            busy={Boolean(busyId)}
            busyId={busyId}
            onPublish={(product) => void transition(product, 'publish')}
            onArchive={(product) => {
              setError('')
              setPending({ product, action: 'archive' })
            }}
            onUnarchive={(product) => {
              setError('')
              setPending({ product, action: 'unarchive' })
            }} />
            : page && <div className="product-empty">
              <FaBoxOpen aria-hidden="true" />
              <h3>
                {search || status ? 'No products match this view' : 'Your catalog starts here'}
              </h3>
              <p>
                {search || status ? 'Try a different search or status filter.' : 'Add your first product and save it as a draft.'}
              </p>
              {search || status ? <button className="portal-button" onClick={() => {
                setSearch('')
                setStatus('')
                setPageNumber(1)
              }}>
                Clear filters
              </button> : <Link className="portal-button portal-button-primary" to="/products/new">
                <FaPlus aria-hidden="true" />
                Add product
              </Link>}
            </div>}
        {page && !loading && <footer className="product-pagination">
          <p>
            {`Page ${page.current_page} of ${page.last_page}`}
          </p>
          <div>
            <button
              className="portal-button"
              aria-label="Previous product page"
              disabled={page.current_page <= 1}
              onClick={() => setPageNumber((value) => value - 1)}>
              <FaArrowLeft aria-hidden="true" />
              <span>
                Previous
              </span>
            </button>
            <button
              className="portal-button"
              aria-label="Next product page"
              disabled={page.current_page >= page.last_page}
              onClick={() => setPageNumber((value) => value + 1)}>
              <span>
                Next
              </span>
              <FaArrowRight aria-hidden="true" />
            </button>
          </div>
        </footer>}
      </section>
      {pending && <ConfirmationDialog
        title={pending.action === 'archive' ? 'Archive product?' : 'Unarchive product?'}
        confirmLabel={pending.action === 'archive' ? 'Archive product' : 'Unarchive product'}
        destructive={pending.action === 'archive'}
        busy={Boolean(busyId)}
        onClose={() => {
          setPending(null)
          setError('')
        }}
        onConfirm={() => void transition(pending.product, pending.action)}>
        <p>
          <strong>
            {pending.product.name}
          </strong>
          {pending.action === 'archive' ? ' will be hidden from buyers. Its catalog and inventory history will be kept.' : ' will return to Draft. Its inventory will be active again, but buyers will not see it until you publish it.'}
        </p>
        {error && <p className="product-error" role="alert">
          {error}
        </p>}
      </ConfirmationDialog>}
    </div>
  )
}
