import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import type { InventorySku, Page } from '../types/operations'

function variantLabel(variant: InventorySku['variant']): string {
  return variant?.option_values.map(({ group, value }) => group ? `${group}: ${value}` : value).join(' / ') ?? ''
}

export function InventoryPage() {
  const [page, setPage] = useState<Page<InventorySku> | null>(null)
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState('')
  useEffect(() => {
    document.title = 'Inventory | Aisley Seller'
    const query = new URLSearchParams({ ...(search ? { search } : {}), ...(stock ? { stock } : {}) })
    apiRequest<Page<InventorySku>>(`/api/v1/seller/inventory?${query}`).then(setPage)
  }, [search, stock])
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8"><div className="border-b border-zinc-200 pb-5 dark:border-white/10"><h2 className="text-2xl font-semibold">Inventory</h2><p className="mt-1 text-sm text-zinc-500">Available stock is on-hand minus reserved stock. Every adjustment is recorded.</p></div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU" value={search} /><select className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setStock(e.target.value)} value={stock}><option value="">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div>
    <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">{!page ? <p className="p-5 text-sm text-zinc-500">Loading inventory…</p> : page.data.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No inventory matches this view.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Product / SKU</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Reserved</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">State</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{page.data.map((sku) => <tr key={sku.id}><td className="px-4 py-4"><Link className="font-medium text-[#4C1268] dark:text-purple-300" to={`/inventory/${sku.id}`}>{sku.product.name}</Link>{sku.variant ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{variantLabel(sku.variant)}</p> : null}<p className="mt-1 font-mono text-xs text-zinc-500">{sku.code}</p></td><td className="px-4 py-4 tabular-nums">{sku.on_hand}</td><td className="px-4 py-4 tabular-nums">{sku.reserved}</td><td className="px-4 py-4 font-medium tabular-nums">{sku.available}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${sku.stock_state === 'out' ? 'bg-red-100 text-red-800' : sku.stock_state === 'low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{sku.stock_state.replace('_', ' ')}</span></td></tr>)}</tbody></table></div>}</div>
  </div>
}
