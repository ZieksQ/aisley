import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, apiAssetUrl } from '../../lib/api'
import { getProduct, getProductOptions, saveProduct, uploadProductImage } from '../../lib/products'
import type { Product } from '../../types/operations'
import { emptyProductForm } from '../../types/productForm'
import type { Category, OptionGroup, Variant, ProductLimits, GalleryUpload } from '../../types/productForm'
export function useProductForm(productId?: string) {
  const navigate = useNavigate()
  const [uploadToken] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState(emptyProductForm)
  const [categories, setCategories] = useState<Category[]>([])
  const [limits, setLimits] = useState<ProductLimits>({
    gallery_images: 10,
    variant_images_per_variant: 1,
    image_max_bytes: 10 * 1024 * 1024,
    image_max_edge: 8000,
    image_max_pixels: 40000000
  })
  const [groups, setGroups] = useState<OptionGroup[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [galleryUploads, setGalleryUploads] = useState<GalleryUpload[]>([])
  const [existingGallery, setExistingGallery] = useState<Product['gallery']>([])
  const [defaultGalleryId, setDefaultGalleryId] = useState<string | null>(null)
  const [galleryDirty, setGalleryDirty] = useState(false)
  const [variantsDirty, setVariantsDirty] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [activeUploads, setActiveUploads] = useState(0)
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    document.title = (productId ? 'Edit' : 'Add') + ' product | Aisley Seller'
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    Promise.all([getProductOptions(controller.signal), productId ? getProduct(productId, controller.signal) : Promise.resolve(null)]).then(([options, response]) => {
      if (controller.signal.aborted)
        return
      setCategories(options.categories)
      setLimits(options.limits)
      if (!response) {
        setLoading(false)
        return
      }
      const { data } = response
      setForm({
        ...emptyProductForm,
        name: data.name,
        category_id: data.category_id,
        short_description: data.short_description ?? '',
        description_markdown: data.description_markdown ?? '',
        price: data.price,
        original_price: data.original_price ?? '',
        sku: data.base_sku,
        opening_stock: String(data.skus[0]?.on_hand ?? 0),
        shipping_weight_grams: String(data.shipping_weight_grams ?? ''),
        shipping_length_mm: String(data.shipping_length_mm ?? ''),
        shipping_width_mm: String(data.shipping_width_mm ?? ''),
        shipping_height_mm: String(data.shipping_height_mm ?? ''),
        unit_cost: data.unit_cost_cents === null ? '' : (data.unit_cost_cents / 100).toFixed(2)
      })
      setExistingGallery(data.gallery)
      setDefaultGalleryId(data.gallery.find((item) => item.is_default)?.id ?? data.gallery[0]?.id ?? null)
      setGroups(data.option_groups.map((group) => ({ name: group.name, values: group.values.map((value) => value.value) })))
      setVariants(data.variants.map((variant) => ({
        key: crypto.randomUUID(),
        id: variant.id,
        option_value_indexes: data.option_groups.map((group) => group.values.findIndex((value) => variant.option_value_ids.includes(value.id))),
        labels: data.option_groups.map((group) => group.values.find((value) => variant.option_value_ids.includes(value.id))?.value ?? ''),
        sku: variant.sku,
        opening_stock: String(variant.on_hand ?? 0),
        price: variant.price ?? '',
        original_price: variant.original_price ?? '',
        status: variant.status,
        shipping_override_enabled: [variant.shipping_weight_grams, variant.shipping_length_mm, variant.shipping_width_mm, variant.shipping_height_mm].some((value) => value !== null),
        shipping_weight_grams: String(variant.shipping_weight_grams ?? ''),
        shipping_length_mm: String(variant.shipping_length_mm ?? ''),
        shipping_width_mm: String(variant.shipping_width_mm ?? ''),
        shipping_height_mm: String(variant.shipping_height_mm ?? ''),
        unit_cost: variant.unit_cost_cents === null ? '' : (variant.unit_cost_cents / 100).toFixed(2),
        image_preview: variant.primary_media_id ? apiAssetUrl('/api/v1/seller/product-media/' + variant.primary_media_id) : undefined,
        inventory_sku_id: variant.inventory_sku_id,
        on_hand: variant.on_hand,
        reserved: variant.reserved,
        available: variant.available,
      })))
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError(cause instanceof ApiError ? cause.message : 'Unable to load product details.')
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [productId, reload])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty)
        event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const descriptionUploading = useCallback((uploading: boolean) => {
    setActiveUploads((count) => count + (uploading ? 1 : -1))
    if (uploading)
      setDirty(true)
  }, [])
  const addDescriptionAsset = useCallback((id: string) => {
    void id
    setDirty(true)
  }, [])
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
  function updateField(key: keyof typeof emptyProductForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: [] }))
    setDirty(true)
  }
  function addVariant() {
    if (!groups.length || groups.some((group) => !group.values.some((value) => value.trim()))) {
      setError('Add at least one value to each option before adding a variant.')
      return
    }
    if (variants.length >= 500) {
      setError('A Product may have at most 500 variants.')
      return
    }
    const used = new Set(variants.map((variant) => variant.option_value_indexes.join(':')))
    let indexes: number[] | null = null
    const findUnused = (groupIndex: number, current: number[]) => {
      if (indexes)
        return
      if (groupIndex === groups.length) {
        if (!used.has(current.join(':')))
          indexes = current
        return
      }
      groups[groupIndex].values.forEach((value, valueIndex) => {
        if (value.trim())
          findUnused(groupIndex + 1, [...current, valueIndex])
      })
    }
    findUnused(0, [])
    if (!indexes) {
      setError('All available option combinations are already listed.')
      return
    }
    const selectedIndexes = indexes
    setVariants((current) => [...current, {
      key: crypto.randomUUID(),
      option_value_indexes: selectedIndexes,
      labels: labelsFor(selectedIndexes),
      sku: (form.sku || 'SKU') + '-' + (current.length + 1),
      opening_stock: '0',
      price: '',
      original_price: '',
      shipping_override_enabled: false,
      shipping_weight_grams: '',
      shipping_length_mm: '',
      shipping_width_mm: '',
      shipping_height_mm: '',
      unit_cost: '',
      status: 'active'
    }])
    setVariantsDirty(true)
    setDirty(true)
    setError('')
  }
  function removeVariant(index: number) {
    setVariants((current) => current.filter((_, position) => position !== index))
    setVariantsDirty(true)
    setDirty(true)
  }
  function updateVariantOption(variantIndex: number, groupIndex: number, value: string) {
    const valueIndex = value === '' ? -1 : Number(value)
    setVariants((current) => current.map((variant, index) => {
      if (index !== variantIndex)
        return variant
      const indexes = variant.option_value_indexes.map((entry, position) => position === groupIndex ? valueIndex : entry)
      return {
        ...variant,
        option_value_indexes: indexes,
        labels: labelsFor(indexes)
      }
    }))
    setVariantsDirty(true)
    setDirty(true)
    setError('')
  }
  function updateVariantShipping(variantIndex: number, key: 'shipping_weight_grams' | 'shipping_length_mm' | 'shipping_width_mm' | 'shipping_height_mm' | 'unit_cost', value: string) {
    setVariants((current) => current.map((variant, index) => index === variantIndex ? { ...variant, [key]: value } : variant))
    setVariantsDirty(true)
    setDirty(true)
  }
  function toggleVariantShipping(variantIndex: number, enabled: boolean) {
    setVariants((current) => current.map((variant, index) => index === variantIndex ? {
      ...variant,
      shipping_override_enabled: enabled,
      ...(enabled ? {} : {
        shipping_weight_grams: '',
        shipping_length_mm: '',
        shipping_width_mm: '',
        shipping_height_mm: ''
      }),
    } : variant))
    setVariantsDirty(true)
    setDirty(true)
  }
  function addOptionGroup() {
    const next = [...groups, { name: '', values: [''] }]
    setGroups(next)
    setVariants((rows) => rows.map((variant) => {
      const indexes = [...variant.option_value_indexes, -1]
      return {
        ...variant,
        option_value_indexes: indexes,
        labels: labelsFor(indexes, next)
      }
    }))
    setVariantsDirty(true)
    setDirty(true)
  }
  function removeOptionGroup(groupIndex: number) {
    const next = groups.filter((_, index) => index !== groupIndex)
    setGroups(next)
    setVariants((current) => next.length === 0 ? [] : current.map((variant) => {
      const indexes = variant.option_value_indexes.filter((_, index) => index !== groupIndex)
      return {
        ...variant,
        option_value_indexes: indexes,
        labels: labelsFor(indexes, next)
      }
    }))
    setVariantsDirty(true)
    setDirty(true)
  }
  function updateOptionValue(groupIndex: number, valueIndex: number, value: string) {
    const next = groups.map((group, index) => index === groupIndex ? { ...group, values: group.values.map((entry, position) => position === valueIndex ? value : entry) } : group)
    setGroups(next)
    setVariants((current) => current.map((variant) => ({ ...variant, labels: labelsFor(variant.option_value_indexes, next) })))
    setVariantsDirty(true)
    setDirty(true)
  }
  function addOptionValue(groupIndex: number) {
    setGroups((current) => current.map((group, index) => index === groupIndex ? { ...group, values: [...group.values, ''] } : group))
    setVariantsDirty(true)
    setDirty(true)
  }
  function removeOptionValue(groupIndex: number, valueIndex: number) {
    const next = groups.map((group, index) => index === groupIndex ? { ...group, values: group.values.filter((_, position) => position !== valueIndex) } : group)
    setGroups(next)
    setVariants((current) => current.map((variant) => {
      const indexes = variant.option_value_indexes.map((entry, index) => index !== groupIndex ? entry : entry === valueIndex ? -1 : entry > valueIndex ? entry - 1 : entry)
      return {
        ...variant,
        option_value_indexes: indexes,
        labels: labelsFor(indexes, next)
      }
    }))
    setVariantsDirty(true)
    setDirty(true)
  }
  function removeGalleryItem(id: string, temporary: boolean) {
    if (temporary)
      setGalleryUploads((current) => current.filter((item) => item.id !== id))
    else
      setExistingGallery((current) => current.filter((item) => item.id !== id))
    setDefaultGalleryId((current) => current === id ? null : current)
    setGalleryDirty(true)
    setDirty(true)
  }
  async function uploadImage(file: File, purpose: 'gallery' | 'variant', variantIndex?: number) {
    setDirty(true)
    const variantKey = variantIndex === undefined ? undefined : variants[variantIndex]?.key
    setActiveUploads((count) => count + 1)
    const body = new FormData()
    body.append('image', file)
    body.append('purpose', purpose)
    body.append('upload_token', uploadToken)
    body.append('alt_text', form.name || 'Product image')
    try {
      const result = await uploadProductImage(body, (progress) => setUploadStatus('Uploading ' + purpose + ' image… ' + progress + '%'))
      if (purpose === 'gallery') {
        setGalleryUploads((current) => [...current, { id: result.data.id, name: file.name }])
        setDefaultGalleryId((current) => current ?? (existingGallery.length === 0 && galleryUploads.length === 0 ? result.data.id : current))
        setGalleryDirty(true)
      }
      else if (variantKey !== undefined) {
        setVariantsDirty(true)
        setVariants((current) => current.map((variant) => variant.key === variantKey ? {
          ...variant,
          image_upload_id: result.data.id,
          image_preview: apiAssetUrl(result.data.preview_url)
        } : variant))
      }
      setUploadStatus('Image uploaded and waiting for Product save.')
      setDirty(true)
    }
    catch (cause) {
      setUploadStatus(cause instanceof ApiError ? Object.values(cause.errors)[0]?.[0] ?? cause.message : 'Image upload failed. Try again.')
    }
    finally {
      setActiveUploads((count) => count - 1)
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || activeUploads)
      return
    setSaving(true)
    setError('')
    setFieldErrors({})
    const incompleteOverride = variants.findIndex((variant) => variant.shipping_override_enabled && [variant.shipping_weight_grams, variant.shipping_length_mm, variant.shipping_width_mm, variant.shipping_height_mm].some((value) => value === ''))
    if (incompleteOverride >= 0) {
      setError(`Complete all packed measurements for ${variantContext(variants[incompleteOverride]) || variants[incompleteOverride].sku}.`)
      setSaving(false)
      return
    }
    try {
      await saveProduct({
        productId,
        form,
        variants,
        groups,
        galleryUploads,
        existingGallery,
        defaultGalleryId,
        galleryDirty,
        variantsDirty,
        uploadToken
      })
      setDirty(false)
      navigate('/products', { replace: true })
    }
    catch (cause) {
      if (cause instanceof ApiError)
        setFieldErrors(cause.errors)
      setError(cause instanceof ApiError ? Object.values(cause.errors)[0]?.[0] ?? cause.message : 'Unable to save product.')
    }
    finally {
      setSaving(false)
    }
  }
  function updateVariant(index: number, key: 'sku' | 'price' | 'original_price' | 'opening_stock', value: string) {
    setVariants((current) => current.map((item, position) => position === index ? { ...item, [key]: value } : item))
    setVariantsDirty(true)
    setDirty(true)
  }
  function updateGroupName(groupIndex: number, name: string) {
    setGroups((current) => current.map((item, index) => index === groupIndex ? { ...item, name } : item))
    setVariantsDirty(true)
    setDirty(true)
  }
  function selectDefaultGallery(id: string) {
    setDefaultGalleryId(id)
    setGalleryDirty(true)
    setDirty(true)
  }
  return {
    form,
    categories,
    limits,
    groups,
    variants,
    galleryUploads,
    existingGallery,
    defaultGalleryId,
    dirty,
    loading,
    loadError,
    error,
    fieldErrors,
    uploadStatus,
    activeUploads,
    saving,
    uploadToken,
    updateField,
    addVariant,
    removeVariant,
    updateVariantOption,
    updateVariantShipping,
    toggleVariantShipping,
    addOptionGroup,
    removeOptionGroup,
    updateOptionValue,
    addOptionValue,
    removeOptionValue,
    removeGalleryItem,
    uploadImage,
    submit,
    addDescriptionAsset,
    updateVariant,
    updateGroupName,
    selectDefaultGallery,
    variantContext,
    descriptionUploading,
    retry: () => setReload((value) => value + 1)
  }
}
export type ProductFormState = ReturnType<typeof useProductForm>
