export type HomepageAd = {
  id?: string
  slot: 'primary' | 'secondary_top' | 'secondary_bottom'
  position: number
  image_desktop_path: string
  image_desktop_filename: string
  image_desktop_url?: string | null
  image_mobile_path: string
  image_mobile_filename: string
  image_mobile_url?: string | null
  destination_url: string
  is_active: boolean
}

export type HomepageConfiguration = {
  id: string
  tag_title: string
  layout: 'single' | 'carousel' | 'multi_block' | 'multi_block_carousel'
  rotation_interval_seconds: number
  starts_at: string
  ends_at: string
  status: 'draft' | 'published' | 'archived'
  revision: number
  ads: HomepageAd[]
}
