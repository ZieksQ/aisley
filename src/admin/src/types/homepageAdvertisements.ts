export type HomepageAd = {
  id?: string
  slot: 'primary' | 'secondary_top' | 'secondary_bottom'
  position: number
  title: string
  description: string
  image_desktop_path: string
  image_mobile_path: string
  alt_text: string
  destination_url: string
  starts_at: string
  ends_at: string
  is_active: boolean
}

export type HomepageConfiguration = {
  id: string
  layout: 'single' | 'carousel' | 'multi_block' | 'multi_block_carousel'
  rotation_interval_seconds: number
  status: 'draft' | 'published' | 'archived'
  revision: number
  ads: HomepageAd[]
}
