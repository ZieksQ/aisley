export type FeatureControl = {
  id: string
  key: string
  label: string
  description: string | null
  enabled: boolean
  revision: number
  updated_at: string | null
  updated_by?: { id: string; email: string } | null
}

export type FeatureControlResponse = { data: FeatureControl[] }
