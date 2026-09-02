import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaImage, FaPlus, FaTrash } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProductDescriptionEditor } from '../components/products/ProductDescriptionEditor'
import { ApiError, apiAssetUrl, apiRequest, uploadForm } from '../lib/api'
import type { Product } from '../types/operations'

type Category = { id: string; name: string }
type OptionGroup = { name: string; values: string[] }
type Variant = { key: string; option_value_indexes: number[]; labels: string[]; sku: string; opening_stock: string; price: string; original_price: string; status: 'active' | 'inactive'; image_upload_id?: string; image_preview?: string; inventory_sku_id?: string | null; on_hand?: number; reserved?: number; available?: number }
type UploadedAsset = { id: string; preview_url: string }
type ProductLimits = { gallery_images: number; variant_images_per_variant: number; image_max_bytes: number; image_max_edge: number; image_max_pixels: number }
type GalleryUpload = { id: string; name: string }
const empty = { name: '', category_id: '', sku: '', short_description: '', description_markdown: '', price: '', original_price: '', opening_stock: '0' }

export function ProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [uploadToken] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState<Category[]>([])
  const [limits, setLimits] = useState<ProductLimits>({ gallery_images: 10, variant_images_per_variant: 1, image_max_bytes: 10 * 1024 * 1024, image_max_edge: 8000, image_max_pixels: 40000000 })
  const [groups, setGroups] = useState<OptionGroup[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [galleryUploads, setGalleryUploads] = useState<GalleryUpload[]>([])
  const [existingGallery, setExistingGallery] = useState<Product['gallery']>([])
  const [defaultGalleryId, setDefaultGalleryId] = useState<string | null>(null)
  const [galleryDirty, setGalleryDirty] = useState(false)
  const [variantsDirty, setVariantsDirty] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(productId))
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = (productId ? 'Edit' : 'Add') + ' product | Aisley Seller'
    apiRequest<{ categories: Category[]; limits: ProductLimits }>('/api/v1/seller/products/options').then((response) => { setCategories(response.categories); setLimits(response.limits) }).catch(() => setError('Unable to load Product categories.'))
    if (!productId) return
    apiRequest<{ data: Product }>('/api/v1/seller/products/' + productId).then(({ data }) => {
      setForm({ ...empty, name: data.name, category_id: data.category_id, short_description: data.short_description ?? '', description_markdown: data.description_markdown ?? '', price: data.price, original_price: data.original_price ?? '', sku: data.base_sku, opening_stock: String(data.skus[0]?.on_hand ?? 0) })
      setExistingGallery(data.gallery)
      setDefaultGalleryId(data.gallery.find((item) => item.is_default)?.id ?? data.gallery[0]?.id ?? null)
      setGroups(data.option_groups.map((group) => ({ name: group.name, values: group.values.map((value) => value.value) })))
      setVariants(data.variants.map((variant) => ({
        key: crypto.randomUUID(),
        option_value_indexes: data.option_groups.map((group) => group.values.findIndex((value) => variant.option_value_ids.includes(value.id))),
        labels: data.option_groups.map((group) => group.values.find((value) => variant.option_value_ids.includes(value.id))?.value ?? ''),
        sku: variant.sku, opening_stock: String(variant.on_hand ?? 0), price: variant.price ?? '', original_price: variant.original_price ?? '', status: variant.status,
        inventory_sku_id: variant.inventory_sku_id, on_hand: variant.on_hand, reserved: variant.reserved, available: variant.available,
      })))
      setLoading(false)
    }).catch((cause: unknown) => { setError(cause instanceof ApiError ? cause.message : 'Unable to load this Product.'); setLoading(false) })
  }, [productId])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const addDescriptionAsset = useCallback((id: string) => { void id; setDirty(true) }, [])

  function labelsFor(indexes: number[], sourceGroups = groups) {
    return sourceGroups.map((group, groupIndex) => {
      const valueIndex = indexes[groupIndex]
      return valueIndex === undefined || valueIndex < 0 ? '' : group.values[valueIndex]?.trim() ?? ''
    })
  }

  function variantContext(variant: Variant) {
    return groups.map((group, groupIndex) => {
      const valueIndex = variant.option_value_indexes[groupIndex]
      const value = valueIndex === undefined || valueIndex < 0 ? '' : group.values[valueIndex]?.trim() ?? ''
      return (group.name.trim() || 'Option ' + (groupIndex + 1)) + ': ' + (value || 'Select value')
    }).join(' / ')
  }

  function updateField(key: keyof typeof empty, value: string) {
    setForm((current) => ({ ...current, [key]: value })); setDirty(true)
  }

  function addVariant() {
    if (!groups.length || groups.some((group) => !group.values.some((value) => value.trim()))) {
      setError('Add at least one value to each option before adding a variant.'); return
    }
    if (variants.length >= 500) { setError('A Product may have at most 500 variants.'); return }
    const used = new Set(variants.map((variant) => variant.option_value_indexes.join(':')))
    let indexes: number[] | null = null
    const findUnused = (groupIndex: number, current: number[]) => {
      if (indexes) return
      if (groupIndex === groups.length) {
        if (!used.has(current.join(':'))) indexes = current
        return
      }
      groups[groupIndex].values.forEach((value, valueIndex) => {
        if (value.trim()) findUnused(groupIndex + 1, [...current, valueIndex])
      })
    }
    findUnused(0, [])
    if (!indexes) { setError('All available option combinations are already listed.'); return }
    const selectedIndexes = indexes
    setVariants((current) => [...current, { key: crypto.randomUUID(), option_value_indexes: selectedIndexes, labels: labelsFor(selectedIndexes), sku: (form.sku || 'SKU') + '-' + (current.length + 1), opening_stock: '0', price: '', original_price: '', status: 'active' }])
    setVariantsDirty(true); setDirty(true); setError('')
  }

  function removeVariant(index: number) {
    setVariants((current) => current.filter((_, position) => position !== index)); setVariantsDirty(true); setDirty(true)
  }

  function updateVariantOption(variantIndex: number, groupIndex: number, value: string) {
    const valueIndex = value === '' ? -1 : Number(value)
    setVariants((current) => current.map((variant, index) => {
      if (index !== variantIndex) return variant
      const indexes = variant.option_value_indexes.map((entry, position) => position === groupIndex ? valueIndex : entry)
      return { ...variant, option_value_indexes: indexes, labels: labelsFor(indexes) }
    }))
    setVariantsDirty(true); setDirty(true); setError('')
  }

  function addOptionGroup() {
    const next = [...groups, { name: '', values: [''] }]
    setGroups(next)
    setVariants((rows) => rows.map((variant) => {
      const indexes = [...variant.option_value_indexes, -1]
      return { ...variant, option_value_indexes: indexes, labels: labelsFor(indexes, next) }
    }))
    setVariantsDirty(true); setDirty(true)
  }

  function removeOptionGroup(groupIndex: number) {
    const next = groups.filter((_, index) => index !== groupIndex)
    setGroups(next)
    setVariants((current) => next.length === 0 ? [] : current.map((variant) => {
      const indexes = variant.option_value_indexes.filter((_, index) => index !== groupIndex)
      return { ...variant, option_value_indexes: indexes, labels: labelsFor(indexes, next) }
    }))
    setVariantsDirty(true); setDirty(true)
  }

  function updateOptionValue(groupIndex: number, valueIndex: number, value: string) {
    const next = groups.map((group, index) => index === groupIndex ? { ...group, values: group.values.map((entry, position) => position === valueIndex ? value : entry) } : group)
    setGroups(next); setVariants((current) => current.map((variant) => ({ ...variant, labels: labelsFor(variant.option_value_indexes, next) })))
    setVariantsDirty(true); setDirty(true)
  }

  function addOptionValue(groupIndex: number) {
    setGroups((current) => current.map((group, index) => index === groupIndex ? { ...group, values: [...group.values, ''] } : group))
    setVariantsDirty(true); setDirty(true)
  }

  function removeOptionValue(groupIndex: number, valueIndex: number) {
    const next = groups.map((group, index) => index === groupIndex ? { ...group, values: group.values.filter((_, position) => position !== valueIndex) } : group)
    setGroups(next)
    setVariants((current) => current.map((variant) => {
      const indexes = variant.option_value_indexes.map((entry, index) => index !== groupIndex ? entry : entry === valueIndex ? -1 : entry > valueIndex ? entry - 1 : entry)
      return { ...variant, option_value_indexes: indexes, labels: labelsFor(indexes, next) }
    }))
    setVariantsDirty(true); setDirty(true)
  }

  function removeGalleryItem(id: string, temporary: boolean) {
    if (temporary) setGalleryUploads((current) => current.filter((item) => item.id !== id))
    else setExistingGallery((current) => current.filter((item) => item.id !== id))
    setDefaultGalleryId((current) => current === id ? null : current)
    setGalleryDirty(true); setDirty(true)
  }

  async function uploadImage(file: File, purpose: 'gallery' | 'variant', variantIndex?: number) {
    const body = new FormData(); body.append('image', file); body.append('purpose', purpose); body.append('upload_token', uploadToken); body.append('alt_text', form.name || 'Product image')
    try {
      const result = await uploadForm<{ data: UploadedAsset }>('/api/v1/seller/product-uploads', body, (progress) => setUploadStatus('Uploading ' + purpose + ' image… ' + progress + '%'))
      if (purpose === 'gallery') {
        setGalleryUploads((current) => [...current, { id: result.data.id, name: file.name }])
        setDefaultGalleryId((current) => current ?? (existingGallery.length === 0 && galleryUploads.length === 0 ? result.data.id : current))
        setGalleryDirty(true)
      } else if (variantIndex !== undefined) {
        setVariants((current) => current.map((variant, index) => index === variantIndex ? { ...variant, image_upload_id: result.data.id, image_preview: apiAssetUrl(result.data.preview_url) } : variant))
      }
      setUploadStatus('Image uploaded and waiting for Product save.'); setDirty(true)
    } catch (cause) { setUploadStatus(cause instanceof ApiError ? Object.values(cause.errors)[0]?.[0] ?? cause.message : 'Image upload failed. Try again.') }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const common = {
      name: form.name, category_id: form.category_id, short_description: form.short_description || null,
      description_markdown: form.description_markdown || null,
      description_asset_ids: Array.from(form.description_markdown.matchAll(/\/api\/v1\/product-description-assets\/([0-9a-f-]{36})/gi), (match) => match[1]),
      price: form.price, original_price: form.original_price || null, currency: 'PHP', upload_token: uploadToken,
    }
    const matrix = variants.map(({ sku, opening_stock, price, original_price, status, option_value_indexes, image_upload_id }) => ({
      sku, price: price || null, original_price: original_price || null, status, option_value_indexes, image_upload_id: image_upload_id || null,
      ...(productId ? {} : { opening_stock: Number(opening_stock) }),
    }))
    const galleryItems = [...existingGallery.map((image) => image.id), ...galleryUploads.map((image) => image.id)]
    const selectedGalleryId = defaultGalleryId && galleryItems.includes(defaultGalleryId) ? defaultGalleryId : galleryItems[0] ?? null
    const selectedUploadId = galleryUploads.some(({ id }) => id === selectedGalleryId) ? selectedGalleryId : null
    const selectedMediaId = existingGallery.some(({ id }) => id === selectedGalleryId) ? selectedGalleryId : null
    const galleryChanged = galleryDirty || galleryUploads.length > 0
    const updateGallery = galleryChanged ? {
      gallery_media_ids: existingGallery.map(({ id }) => id), gallery_upload_ids: galleryUploads.map(({ id }) => id),
      ...(selectedUploadId ? { default_gallery_upload_id: selectedUploadId } : {}), ...(selectedMediaId ? { default_gallery_media_id: selectedMediaId } : {}),
    } : (selectedMediaId ? { default_gallery_media_id: selectedMediaId } : {})
    const payload = productId ? {
      ...common, ...updateGallery, ...(variantsDirty ? { option_groups: groups, variants: matrix } : {}),
    } : {
      ...common, sku: form.sku, opening_stock: Number(form.opening_stock), option_groups: groups,
      variants: matrix, gallery_upload_ids: galleryUploads.map(({ id }) => id), default_gallery_upload_id: selectedUploadId,
    }
    try {
      await apiRequest<{ data: Product }>('/api/v1/seller/products' + (productId ? '/' + productId : ''), { method: productId ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setDirty(false); navigate('/products', { replace: true })
    } catch (cause) { setError(cause instanceof ApiError ? Object.values(cause.errors)[0]?.[0] ?? cause.message : 'Unable to save Product.') } finally { setSaving(false) }
  }

  const field = (key: keyof typeof empty, label: string, required = false, type = 'text') => <label className="block text-sm font-medium">{label}{required ? <span className="text-red-600"> *</span> : null}<input className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 focus:border-[#4C1268] focus:outline-none focus:ring-2 focus:ring-[#4C1268]/20 dark:border-white/15 dark:bg-[#18181b]" disabled={productId !== undefined && (key === 'sku' || key === 'opening_stock')} min={type === 'number' ? '0' : undefined} onChange={(e) => updateField(key, e.target.value)} required={required} step={key.includes('price') ? '0.01' : undefined} type={type} value={form[key]} /></label>

  if (loading) return <p className="p-7 text-sm text-zinc-500">Loading Product…</p>

  return <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="border-b border-zinc-200 pb-5 dark:border-white/10"><Link className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white" to="/products">← Products</Link><h2 className="mt-3 text-2xl font-semibold">{productId ? 'Edit product' : 'Add product'}</h2><p className="mt-1 text-sm text-zinc-500">Listings begin as drafts. Variant stock changes after creation belong in Inventory.</p></div>
    <form className="mt-6 space-y-6" onSubmit={submit}>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">{error}</p> : null}
      <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="details-heading"><h3 className="text-lg font-semibold" id="details-heading">Product details</h3>
        {field('name', 'Product name', true)}
        <label className="block text-sm font-medium">Category <span className="text-red-600">*</span><select className="mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 dark:border-white/15 dark:bg-[#18181b]" onChange={(e) => updateField('category_id', e.target.value)} required value={form.category_id}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <div className="grid gap-5 sm:grid-cols-2">{field('sku', 'Base SKU', true)}{groups.length === 0 ? field('opening_stock', 'Opening stock', true, 'number') : <p className="self-end text-sm text-zinc-500">Opening stock is set separately for each variant below.</p>}</div>
        <div className="grid gap-5 sm:grid-cols-2">{field('price', 'Base price (PHP)', true, 'number')}{field('original_price', 'Original price (optional)', false, 'number')}</div>
        <label className="block text-sm font-medium">Short description<textarea className="mt-1.5 min-h-20 w-full rounded-lg border border-zinc-300 bg-white p-3 dark:border-white/15 dark:bg-[#18181b]" maxLength={500} onChange={(e) => updateField('short_description', e.target.value)} value={form.short_description} /></label>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="gallery-heading"><div><h3 className="text-lg font-semibold" id="gallery-heading">Product gallery</h3><p className="mt-1 text-sm text-zinc-500">Up to {limits.gallery_images} gallery images. Choose one as the default cover shown on Customer product cards. Variant images are separate and do not use this limit.</p></div>
        <div className="space-y-1.5">{[...existingGallery.map((image, index) => ({ id: image.id, name: 'Gallery image ' + (index + 1), temporary: false })), ...galleryUploads.map((image) => ({ ...image, temporary: true }))].map((image, index) => { const isDefault = image.id === (defaultGalleryId ?? existingGallery[0]?.id ?? galleryUploads[0]?.id); return <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-2.5 py-1.5 dark:border-white/10" key={image.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{image.name}</p><p className="text-[11px] text-zinc-500">{isDefault ? 'Default cover' : 'Gallery image ' + (index + 1)}{image.temporary ? ' · Pending save' : ''}</p></div><div className="flex shrink-0 items-center gap-1.5">{!isDefault ? <button className="h-7 rounded-md px-2 text-xs font-semibold text-[#4C1268] hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-white/5" onClick={() => { setDefaultGalleryId(image.id); setGalleryDirty(true); setDirty(true) }} type="button">Set default</button> : <span className="px-2 text-[11px] font-semibold text-[#4C1268] dark:text-purple-300">Default</span>}<button aria-label={'Delete ' + image.name} className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5" onClick={() => removeGalleryItem(image.id, image.temporary)} type="button"><FaTrash /> Delete</button></div></div> })}</div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"><FaImage /> Add gallery images<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={existingGallery.length + galleryUploads.length >= limits.gallery_images} multiple onChange={(event) => Array.from(event.target.files ?? []).slice(0, limits.gallery_images - existingGallery.length - galleryUploads.length).forEach((file) => void uploadImage(file, 'gallery'))} type="file" /></label>
        <p aria-live="polite" className="text-xs text-zinc-500">{uploadStatus || 'JPEG, PNG, or WebP; under 10 MiB each; maximum 8,000 px per edge and 40 MP.'}</p>
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="variants-heading"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold" id="variants-heading">Variants</h3><p className="mt-1 text-sm text-zinc-500">Add up to three options, then add each sellable combination manually. Adding a value keeps existing variants; choose it in a new row when needed. Blank prices inherit the Product price.</p></div><div className="flex gap-2"><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" onClick={addVariant} disabled={!groups.length} type="button"><FaPlus /> Add variant</button><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" onClick={addOptionGroup} disabled={groups.length >= 3} type="button"><FaPlus /> Add option</button></div></div>
        {groups.map((group, groupIndex) => <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10" key={groupIndex}><div className="flex gap-3"><input aria-label={'Option ' + (groupIndex + 1) + ' name'} className="h-10 flex-1 rounded-lg border border-zinc-300 px-3 dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => { setGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, name: event.target.value } : item)); setVariantsDirty(true); setDirty(true) }} placeholder="Option name, e.g. Color" value={group.name} /><button aria-label={'Remove option ' + (groupIndex + 1)} className="px-2 text-zinc-500 hover:text-red-700" onClick={() => removeOptionGroup(groupIndex)} type="button"><FaTrash /></button></div><div className="grid gap-2 sm:grid-cols-3">{group.values.map((value, valueIndex) => <div className="flex gap-1" key={valueIndex}><input aria-label={(group.name || 'Option ' + (groupIndex + 1)) + ' value ' + (valueIndex + 1)} className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => updateOptionValue(groupIndex, valueIndex, event.target.value)} placeholder="Value" value={value} /><button aria-label="Remove value" className="px-2 text-zinc-500" onClick={() => removeOptionValue(groupIndex, valueIndex)} type="button">×</button></div>)}<button className="h-9 rounded-lg border border-dashed border-zinc-300 px-3 text-sm text-zinc-600 dark:border-white/15 dark:text-zinc-300" onClick={() => addOptionValue(groupIndex)} type="button">Add value</button></div></div>)}
        {variants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left text-sm"><thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-white/10"><tr><th className="py-2 pr-3">Options</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Price override</th><th className="px-3 py-2">Original override</th><th className="px-3 py-2">Image</th><th className="px-3 py-2">Opening stock / on hand</th><th className="pl-3 py-2"> </th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{variants.map((variant, index) => { const context = variantContext(variant); return <tr key={variant.key}><td className="py-2 pr-3"><div className="space-y-1.5">{groups.map((group, groupIndex) => <select aria-label={context + ' ' + (group.name || 'Option ' + (groupIndex + 1))} className="h-8 w-36 rounded-md border border-zinc-300 px-2 text-xs dark:border-white/15 dark:bg-[#18181b]" key={groupIndex} onChange={(event) => updateVariantOption(index, groupIndex, event.target.value)} value={variant.option_value_indexes[groupIndex] >= 0 ? String(variant.option_value_indexes[groupIndex]) : ''}><option value="">Select {group.name || 'option ' + (groupIndex + 1)}</option>{group.values.map((value, valueIndex) => <option key={valueIndex} value={valueIndex}>{value || 'Value ' + (valueIndex + 1)}</option>)}</select>)}</div></td><td className="px-3 py-2"><input aria-label={context + ' SKU'} className="h-9 w-40 rounded-lg border border-zinc-300 px-2 dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => { setVariants((current) => current.map((item, position) => position === index ? { ...item, sku: event.target.value } : item)); setVariantsDirty(true); setDirty(true) }} required value={variant.sku} /></td><td className="px-3 py-2"><input aria-label={context + ' price override'} className="h-9 w-32 rounded-lg border border-zinc-300 px-2 dark:border-white/15 dark:bg-[#18181b]" min="0.01" onChange={(event) => { setVariants((current) => current.map((item, position) => position === index ? { ...item, price: event.target.value } : item)); setVariantsDirty(true); setDirty(true) }} placeholder={'Inherit ' + (form.price || 'base')} step="0.01" type="number" value={variant.price} /></td><td className="px-3 py-2"><input aria-label={context + ' original price override'} className="h-9 w-32 rounded-lg border border-zinc-300 px-2 dark:border-white/15 dark:bg-[#18181b]" min="0.01" placeholder="Inherit" step="0.01" type="number" value={variant.original_price} onChange={(event) => { setVariants((current) => current.map((item, position) => position === index ? { ...item, original_price: event.target.value } : item)); setVariantsDirty(true); setDirty(true) }} /></td><td className="px-3 py-2"><label className="cursor-pointer text-sm font-medium text-[#4C1268] dark:text-purple-300">{variant.image_preview ? 'Replace' : 'Add image'}<input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setVariantsDirty(true); void uploadImage(file, 'variant', index) } }} type="file" /></label></td><td className="px-3 py-2">{productId ? <><p className="tabular-nums">{variant.on_hand ?? 0} on hand</p>{variant.inventory_sku_id ? <Link className="mt-1 inline-block text-xs font-medium text-[#4C1268] dark:text-purple-300" to={'/inventory/' + variant.inventory_sku_id}>Manage in Inventory</Link> : null}</> : <input aria-label={context + ' opening stock'} className="h-9 w-28 rounded-lg border border-zinc-300 px-2 tabular-nums dark:border-white/15 dark:bg-[#18181b]" min="0" onChange={(event) => { setVariants((current) => current.map((item, position) => position === index ? { ...item, opening_stock: event.target.value } : item)); setDirty(true) }} step="1" type="number" value={variant.opening_stock} />}</td><td className="pl-3 py-2"><button aria-label={'Delete variant ' + (index + 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5" onClick={() => removeVariant(index)} type="button"><FaTrash /> Delete</button></td></tr> })}</tbody></table></div> : groups.length ? <p className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-white/15">No variants yet. Add one sellable combination above.</p> : null}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="description-heading"><div><h3 className="text-lg font-semibold" id="description-heading">Description</h3><p className="mt-1 text-sm text-zinc-500">Rich text is saved as safe Markdown. Images uploaded before the first save remain temporary for 24 hours.</p></div><ProductDescriptionEditor markdown={form.description_markdown} onAsset={addDescriptionAsset} onChange={(value) => updateField('description_markdown', value)} uploadToken={uploadToken} /></section>

      <div className="flex justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-white/10"><Link className="inline-flex h-10 items-center px-4 text-sm font-medium" onClick={(event) => { if (dirty && !window.confirm('Discard your unsaved Product changes?')) event.preventDefault() }} to="/products">Cancel</Link><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-medium text-white hover:bg-[#3d0e54] disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button></div>
    </form>
  </div>
}
