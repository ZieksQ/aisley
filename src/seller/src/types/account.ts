import type { SellerUser } from './auth'

export type SellerAccount = {
  id: string
  email: string
  role: 'seller'
  status: 'active'
  profile: {
    first_name: string
    last_name: string
    middle_name: string | null
    contact_number: string
    sex: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
    birth_date: string
    profile_photo_url: string | null
  }
  shop: {
    id: string
    name: string
    slug: string
    status: 'active'
    description: string | null
    contact_email: string | null
    contact_number: string | null
    website: string | null
    is_on_vacation: boolean
    vacation_message: string | null
  }
  security: {
    two_factor_available: false
    sensitive_edits_require_current_password: true
  }
}

export type SellerAccountResponse = { account: SellerAccount }
export type SellerAccountMutationResponse = {
  message: string
  account: SellerAccount
  seller: SellerUser
}
