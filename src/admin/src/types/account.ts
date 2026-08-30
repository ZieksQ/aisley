import type { AdminUser } from './auth'

export type AdminAccount = {
  id: string
  email: string
  role: 'admin'
  status: 'active'
  profile: {
    first_name: string | null
    last_name: string | null
    middle_name: string | null
    contact_number: string | null
    sex: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null
    birth_date: string | null
    profile_photo_url: string | null
  }
}

export type AdminAccountResponse = { account: AdminAccount }
export type AdminAccountMutationResponse = {
  message: string
  account: AdminAccount
  admin: AdminUser
}
