import type { ShippingOverrideVariant } from '../components/products/VariantShippingOverrides'
export type Category = {
  id: string
  name: string
}
export type OptionGroup = {
  name: string
  values: string[]
}
export type Variant = ShippingOverrideVariant & {
  id?: string
  option_value_indexes: number[]
  labels: string[]
  opening_stock: string
  price: string
  original_price: string
  status: 'active' | 'inactive'
  image_upload_id?: string
  image_preview?: string
  inventory_sku_id?: string | null
  on_hand?: number
  reserved?: number
  available?: number
}
export type UploadedAsset = {
  id: string
  preview_url: string
}
export type ProductLimits = {
  gallery_images: number
  variant_images_per_variant: number
  image_max_bytes: number
  image_max_edge: number
  image_max_pixels: number
}
export type GalleryUpload = {
  id: string
  name: string
}
export const emptyProductForm = {
  name: '',
  category_id: '',
  sku: '',
  short_description: '',
  description_markdown: '',
  price: '',
  original_price: '',
  opening_stock: '0',
  shipping_weight_grams: '',
  shipping_length_mm: '',
  shipping_width_mm: '',
  shipping_height_mm: '',
  unit_cost: ''
}
