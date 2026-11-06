export type SetupGuideSnapshot = {
  version: number
  tenant_id: string | null
  auto_show: boolean
  automatic: Record<string, 'complete' | 'incomplete' | 'unavailable'>
  generated_at: string
}

export type SetupGuideTask = {
  id: string
  title: string
  location: string
  description: string
  automatic?: boolean
  links: Array<{ label: string; to: string }>
}
