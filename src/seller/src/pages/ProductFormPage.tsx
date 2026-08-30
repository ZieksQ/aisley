import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { Product } from '../types/operations'

type Category = { id: string; name: string }
const empty = { name: '', category_id: '', sku: '', short_description: '', description_markdown: '', price: '', original_price: '', opening_stock: '0' }

export function ProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = `${productId ? 'Edit' : 'Add'} product | Aisley Seller`
    apiRequest<{ categories: Category[] }>('/api/v1/seller/products/options').then((r) => setCategories(r.categories))
    if (productId) apiRequest<{ data: Product }>(`/api/v1/seller/products/${productId}`).then(({ data }) => setForm({ ...empty, name: data.name, category_id: data.category_id, short_description: data.short_description ?? '', description_markdown: data.description_markdown ?? '', price: data.price, original_price: data.original_price ?? '', sku: data.skus[0]?.code ?? '', opening_stock: String(data.skus[0]?.on_hand ?? 0) }))
  }, [productId])

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, price: Number(form.price), original_price: form.original_price ? Number(form.original_price) : null, opening_stock: Number(form.opening_stock) }
    try {
      await apiRequest(productId ? `/api/v1/seller/products/${productId}` : '/api/v1/seller/products', { method: productId ? 'PATCH' : 'POST', body: JSON.stringify(productId ? { name: payload.name, category_id: payload.category_id, short_description: payload.short_description || null, description_markdown: payload.description_markdown || null, price: payload.price, original_price: payload.original_price } : payload) })
      navigate('/products')
    } catch (e) { setError(e instanceof ApiError ? Object.values(e.errors)[0]?.[0] ?? e.message : 'Unable to save product.') } finally { setSaving(false) }
  }

  const field = (key: keyof typeof empty, label: string, required = false, type = 'text') => <label className="block text-sm font-medium">{label}{required ? <span className="text-red-600"> *</span> : null}<input className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-white/15 dark:bg-[#18181b]" disabled={productId !== undefined && (key === 'sku' || key === 'opening_stock')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={required} type={type} value={form[key]} /></label>

  return <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 lg:px-8"><div className="border-b border-zinc-200 pb-5 dark:border-white/10"><Link className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white" to="/products">← Products</Link><h2 className="mt-3 text-2xl font-semibold">{productId ? 'Edit product' : 'Add product'}</h2><p className="mt-1 text-sm text-zinc-500">Listings begin as drafts. Stock changes after creation belong in Inventory.</p></div>
    <form className="mt-6 space-y-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]" onSubmit={submit}>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-300">{error}</p> : null}
      {field('name', 'Product name', true)}
      <label className="block text-sm font-medium">Category <span className="text-red-600">*</span><select className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setForm({ ...form, category_id: e.target.value })} required value={form.category_id}><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="grid gap-5 sm:grid-cols-2">{field('sku', 'SKU', true)}{field('opening_stock', 'Opening stock', true, 'number')}</div>
      <div className="grid gap-5 sm:grid-cols-2">{field('price', 'Price', true, 'number')}{field('original_price', 'Original price', false, 'number')}</div>
      <label className="block text-sm font-medium">Short description<textarea className="mt-1.5 min-h-20 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-white/15 dark:bg-[#18181b]" maxLength={500} onChange={(e) => setForm({ ...form, short_description: e.target.value })} value={form.short_description} /></label>
      <label className="block text-sm font-medium">Description <span className="font-normal text-zinc-500">(Markdown)</span><textarea className="mt-1.5 min-h-48 w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => setForm({ ...form, description_markdown: e.target.value })} value={form.description_markdown} /></label>
      <div className="flex justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-white/10"><Link className="inline-flex h-10 items-center px-4 text-sm font-medium" to="/products">Cancel</Link><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-medium text-white disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button></div>
    </form></div>
}
