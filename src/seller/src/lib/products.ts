import { apiRequest, uploadForm } from './api'
import type { Page, Product } from '../types/operations'
import type { Category, ProductLimits, UploadedAsset, Variant, OptionGroup, GalleryUpload, emptyProductForm } from '../types/productForm'
export function listProducts(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<Page<Product>>(`/api/v1/seller/products?${query}`, { signal })
}
export function getProductOptions(signal?: AbortSignal) {
  return apiRequest<{
    categories: Category[]
    limits: ProductLimits
  }>('/api/v1/seller/products/options', { signal })
}
export function getProduct(id: string, signal?: AbortSignal) {
  return apiRequest<{
    data: Product
  }>(`/api/v1/seller/products/${id}`, { signal })
}
export function transitionProduct(id: string, action: 'publish' | 'archive' | 'unarchive') {
  return apiRequest<{
    data: Product
  }>(`/api/v1/seller/products/${id}/${action}`, { method: 'POST' })
}
export function uploadProductImage(body: FormData, onProgress: (progress: number) => void) {
  return uploadForm<{
    data: UploadedAsset
  }>('/api/v1/seller/product-uploads', body, onProgress)
}
export function saveProduct({ productId, form, variants, groups, galleryUploads, existingGallery, defaultGalleryId, galleryDirty, variantsDirty, uploadToken }: {
  productId?: string
  form: typeof emptyProductForm
  variants: Variant[]
  groups: OptionGroup[]
  galleryUploads: GalleryUpload[]
  existingGallery: Product['gallery']
  defaultGalleryId: string | null
  galleryDirty: boolean
  variantsDirty: boolean
  uploadToken: string
}) {
  const common = {
    name: form.name,
    category_id: form.category_id,
    short_description: form.short_description || null,
    description_markdown: form.description_markdown || null,
    description_asset_ids: Array.from(form.description_markdown.matchAll(/\/api\/v1\/product-description-assets\/([0-9a-f-]{36})/gi), (match) => match[1]),
    price: form.price,
    original_price: form.original_price || null,
    currency: 'PHP',
    upload_token: uploadToken,
    shipping_weight_grams: Number(form.shipping_weight_grams),
    shipping_length_mm: Number(form.shipping_length_mm),
    shipping_width_mm: Number(form.shipping_width_mm),
    shipping_height_mm: Number(form.shipping_height_mm),
    unit_cost_cents: form.unit_cost === '' ? null : Math.round(Number(form.unit_cost) * 100),
    cost_currency: form.unit_cost === '' ? null : 'PHP',
  }
  const matrix = variants.map(({ id, sku, opening_stock, price, original_price, status, option_value_indexes, image_upload_id, shipping_override_enabled, shipping_weight_grams, shipping_length_mm, shipping_width_mm, shipping_height_mm, unit_cost }) => ({
    ...(productId && id ? { id } : {}),
    sku,
    price: price || null,
    original_price: original_price || null,
    status,
    option_value_indexes,
    image_upload_id: image_upload_id || null,
    shipping_weight_grams: shipping_override_enabled ? Number(shipping_weight_grams) : null,
    shipping_length_mm: shipping_override_enabled ? Number(shipping_length_mm) : null,
    shipping_width_mm: shipping_override_enabled ? Number(shipping_width_mm) : null,
    shipping_height_mm: shipping_override_enabled ? Number(shipping_height_mm) : null,
    unit_cost_cents: unit_cost === '' ? null : Math.round(Number(unit_cost) * 100),
    cost_currency: unit_cost === '' ? null : 'PHP',
    ...(productId ? {} : { opening_stock: Number(opening_stock) }),
  }))
  const galleryItems = [...existingGallery.map((image) => image.id), ...galleryUploads.map((image) => image.id)]
  const selectedGalleryId = defaultGalleryId && galleryItems.includes(defaultGalleryId) ? defaultGalleryId : galleryItems[0] ?? null
  const selectedUploadId = galleryUploads.some(({ id }) => id === selectedGalleryId) ? selectedGalleryId : null
  const selectedMediaId = existingGallery.some(({ id }) => id === selectedGalleryId) ? selectedGalleryId : null
  const galleryChanged = galleryDirty || galleryUploads.length > 0
  const updateGallery = galleryChanged ? {
    gallery_media_ids: existingGallery.map(({ id }) => id),
    gallery_upload_ids: galleryUploads.map(({ id }) => id),
    ...(selectedUploadId ? { default_gallery_upload_id: selectedUploadId } : {}),
    ...(selectedMediaId ? { default_gallery_media_id: selectedMediaId } : {}),
  } : (selectedMediaId ? { default_gallery_media_id: selectedMediaId } : {})
  const payload = productId ? {
    ...common,
    ...updateGallery,
    ...(variantsDirty ? { option_groups: groups, variants: matrix } : {}),
  } : {
    ...common,
    sku: form.sku,
    opening_stock: Number(form.opening_stock),
    option_groups: groups,
    variants: matrix,
    gallery_upload_ids: galleryUploads.map(({ id }) => id),
    default_gallery_upload_id: selectedUploadId,
  }
  return apiRequest<{
    data: Product
  }>('/api/v1/seller/products' + (productId ? '/' + productId : ''), { method: productId ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
}
