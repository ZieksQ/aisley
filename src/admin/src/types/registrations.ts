export type RegistrationRole = 'customer' | 'seller'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

export type RegistrationSummary = {
  id: string
  applicant: {
    id: string
    name: string
    email: string
  }
  role: RegistrationRole
  status: RegistrationStatus
  submitted_at: string
  reviewed_at: string | null
}

export type RegistrationDetail = {
  id: string
  applicant: {
    id: string
    name: string
    email: string
    role: RegistrationRole
    account_status: 'pending' | 'active' | 'rejected'
  }
  status: RegistrationStatus
  submitted_at: string
  application: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    contact_number: string | null
    sex: string | null
    birth_date: string | null
  }
  documents: Array<{
    id: string
    type: string
    status: 'pending' | 'verified' | 'rejected'
    original_name: string
    mime_type: string
    size_bytes: number
    reviewed_at: string | null
    rejection_reason: string | null
  }>
  review: {
    reviewed_at: string
    rejection_reason: string | null
    reviewed_by: {
      id: string
      name: string
    } | null
  } | null
}

export type RegistrationListResponse = {
  data: RegistrationSummary[]
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

export type RegistrationDetailResponse = {
  data: RegistrationDetail
}
