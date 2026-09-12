export type CourierApplicationStatus = 'pending' | 'approved' | 'rejected'

export type CourierApplicationSummary = {
  id: string
  status: CourierApplicationStatus
  created_at: string
  courier: {
    id: string
    email: string
    name: string
    account_status: string
  }
  application: {
    id: string | null
    status: CourierApplicationStatus | null
    submitted_at: string | null
  }
  completeness: {
    complete: boolean
    missing: string[]
  }
}

export type CourierAddress = {
  address_line_1: string
  address_line_2: string | null
  barangay: string
  city_municipality: string
  province: string
  region: string
  postal_code: string
  country: string
}

export type CourierApplicationDetail = {
  id: string
  status: CourierApplicationStatus
  created_at: string
  organization: {
    id: string
    business_name: string | null
    hub: { id: string; name: string } | null
  }
  courier: {
    id: string | null
    email: string | null
    account_status: string | null
    profile: {
      first_name: string | null
      middle_name: string | null
      last_name: string | null
      contact_number: string | null
      sex: string | null
      birth_date: string | null
      age: number | null
    }
    address: CourierAddress | null
    vehicle: {
      id: string
      type: string | null
      plate_number: string | null
      status: string | null
    } | null
  }
  application: {
    id: string
    status: CourierApplicationStatus
    submitted_at: string
    reviewed_at: string | null
    rejection_reason: string | null
  } | null
  documents: CourierApplicationDocument[]
  completeness: {
    complete: boolean
    missing: string[]
    required_documents: Array<{ type: string; label: string; present: boolean }>
    profile_present: boolean
    address_present: boolean
    vehicle_present: boolean
  }
  review: {
    reviewed_at: string
    reason: string | null
    reviewed_by: { id: string; email: string; name: string } | null
  } | null
}

export type CourierApplicationDocument = {
  id: string
  type: string | null
  label: string
  status: 'pending' | 'verified' | 'rejected' | null
  present: boolean
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  preview_url: string | null
}

export type CourierApplicationPage = {
  data: CourierApplicationSummary[]
  links: { first: string | null; last: string | null; prev: string | null; next: string | null }
  meta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number }
}

export type CourierApplicationDetailResponse = { data: CourierApplicationDetail; message?: string }
