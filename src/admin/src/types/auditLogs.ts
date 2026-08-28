export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue }

export type AuditLogSummary = {
  id: string
  event_id: string
  occurred_at: string | null
  recorded_at: string | null
  actor: {
    id: string | null
    name: string
    email: string | null
  }
  source_feature: string
  source_feature_label: string
  action: string
  action_label: string
  target: {
    type: string
    type_label: string
    id: string
    snapshot: Record<string, AuditJsonValue>
  }
}

export type AuditLogDetail = AuditLogSummary & {
  schema_version: number
  changes: {
    fields: string[]
    before: Record<string, AuditJsonValue>
    after: Record<string, AuditJsonValue>
  }
  metadata: Record<string, AuditJsonValue>
  request_context: {
    request_id: string | null
    ip_address: string | null
    user_agent: string | null
  }
}

export type AuditLogListResponse = {
  data: AuditLogSummary[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

export type AuditLogDetailResponse = {
  data: AuditLogDetail
}

type FilterOption = {
  value: string
  label: string
}

export type AuditLogOptionsResponse = {
  actors: Array<{
    id: string
    name: string
    email: string | null
  }>
  source_features: FilterOption[]
  actions: FilterOption[]
  target_types: FilterOption[]
}
