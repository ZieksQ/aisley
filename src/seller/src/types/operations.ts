export type Product = {
  id: string
  name: string
  category_id: string
  category: string | null
  short_description: string | null
  description_markdown: string | null
  price: string
  original_price: string | null
  status: 'draft' | 'active' | 'archived'
  skus: { id: string; code: string; on_hand: number; reserved: number; available: number }[]
}

export type InventorySku = {
  id: string
  code: string
  status: 'active' | 'inactive'
  product: { id: string; name: string; status: string }
  variant: { id: string; sku: string } | null
  on_hand: number
  reserved: number
  available: number
  alert_threshold: number | null
  stock_state: 'in_stock' | 'low' | 'out'
}

export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
