import { useEffect, useState } from 'react'
import { FaBoxOpen, FaPlus, FaRotateRight } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { Page, Product } from '../types/operations'

export function ProductsPage() {
  const [page, setPage] = useState<Page<Product> | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    document.title = 'Products | Aisley Seller'
    const query = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) })
    apiRequest<Page<Product>>(`/api/v1/seller/products?${query}`).then(setPage).catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Unable to load products.'))
  }, [reload, search, status])

  async function transition(product: Product, action: 'publish' | 'archive') {
    await apiRequest(`/api/v1/seller/products/${product.id}/${action}`, { method: 'POST' })
    setReload((value) => value + 1)
  }

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div><h2 className="text-2xl font-semibold tracking-tight">Products</h2><p className="mt-1 text-sm text-zinc-500">Create drafts, maintain listings, and control publication.</p></div>
      <Link className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-medium text-white hover:bg-[#3d0e54]" to="/products/new"><FaPlus /> Add product</Link>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <input aria-label="Search products" className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name" value={search} />
      <select aria-label="Filter status" className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setStatus(e.target.value)} value={status}><option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select>
    </div>
    {error ? <div className="mt-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button onClick={() => setReload((v) => v + 1)}><FaRotateRight /></button></div> : null}
    <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
      {!page ? <p className="p-5 text-sm text-zinc-500">Loading products…</p> : page.data.length === 0 ? <div className="p-8 text-center"><FaBoxOpen className="mx-auto text-zinc-400" /><p className="mt-3 text-sm text-zinc-500">No products match this view.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Available</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{page.data.map((product) => <tr key={product.id}><td className="px-4 py-4"><Link className="font-medium text-[#4C1268] dark:text-purple-300" to={`/products/${product.id}/edit`}>{product.name}</Link><p className="mt-1 text-xs text-zinc-500">{product.category ?? 'No category'}</p></td><td className="px-4 py-4 capitalize">{product.status}</td><td className="px-4 py-4 tabular-nums">₱{Number(product.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="px-4 py-4 tabular-nums">{product.skus.reduce((n, sku) => n + sku.available, 0)}</td><td className="px-4 py-4 text-right">{product.status === 'draft' ? <button className="font-medium text-[#4C1268] dark:text-purple-300" onClick={() => void transition(product, 'publish')}>Publish</button> : product.status === 'active' ? <button className="font-medium text-zinc-600 dark:text-zinc-300" onClick={() => void transition(product, 'archive')}>Archive</button> : null}</td></tr>)}</tbody></table></div>}
    </div>
  </div>
}
