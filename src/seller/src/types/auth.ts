export type SellerProfile = {
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  contact_number: string | null
  sex: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null
  birth_date: string | null
  profile_photo_path: string | null
}

export type SellerShop = {
  id: string
  name: string
  status: 'active' | 'suspended' | 'deactivated'
  is_on_vacation: boolean
}

export type SellerUser = {
  id: string
  email: string
  role: 'seller'
  status: 'pending' | 'active' | 'rejected' | 'suspended' | 'deactivated'
  profile: SellerProfile | null
  shop: SellerShop | null
}

export type AuthResponse = {
  message?: string
  seller: SellerUser
}

export type LoginCredentials = {
  email: string
  password: string
  remember: boolean
}

export type RegistrationPayload = {
  first_name: string
  last_name: string
  middle_name: string | null
  contact_number: string
  sex: NonNullable<SellerProfile['sex']>
  birth_date: string
  email: string
  password: string
  password_confirmation: string
}
