export type Product = {
  id: string
  name: string
  base_sku: string
  category_id: string
  category: string | null
  short_description: string | null
  description_markdown: string | null
  price: string
  original_price: string | null
  currency: 'PHP'
  status: 'draft' | 'active' | 'archived'
  skus: { id: string; code: string; on_hand: number; reserved: number; available: number }[]
  gallery: { id: string; url: string; alt_text: string; position: number }[]
  description_asset_ids: string[]
  option_groups: { id: string; name: string; values: { id: string; value: string }[] }[]
  variants: {
    id: string
    sku: string
    price: string | null
    original_price: string | null
    effective_price: string
    effective_original_price: string | null
    inherits_price: boolean
    status: 'active' | 'inactive'
    option_value_ids: string[]
    inventory_sku_id: string | null
    on_hand: number
    reserved: number
    available: number
    primary_media_id: string | null
  }[]
}

export type InventorySku = {
  id: string
  code: string
  status: 'active' | 'inactive'
  product: { id: string; name: string; status: string }
  variant: { id: string; sku: string; option_values: { group: string | null; value: string }[] } | null
  on_hand: number
  reserved: number
  available: number
  alert_threshold: number | null
  stock_state: 'in_stock' | 'low' | 'out'
}

export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
