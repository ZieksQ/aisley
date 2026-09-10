export type LogisticsAccount = {
  id: string
  email: string
  role: 'logistics'
  status: string
  profile: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    contact_number: string | null
    sex: string | null
    birth_date: string | null
    age: number | null
    profile_photo_url: string | null
  }
  organization: { id: string | null; business_name: string | null }
  hub: {
    id: string | null
    name: string | null
    address: {
      address_line_1: string | null
      address_line_2: string | null
      barangay: string | null
      city_municipality: string | null
      province: string | null
      region: string | null
      postal_code: string | null
      country: string | null
    } | null
  }
  security: {
    email_editable: boolean
    password_change_requires_current_password: boolean
    organization_editable: boolean
    hub_name_editable: boolean
    hub_address_editable: boolean
  }
}

export type AccountResponse = { message?: string; account: LogisticsAccount }
