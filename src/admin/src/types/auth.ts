export type AdminProfile = {
  first_name: string | null
  last_name: string | null
  profile_photo_url: string | null
}

export type AdminUser = {
  id: string
  email: string
  role: 'admin'
  status: 'active'
  profile: AdminProfile | null
  permissions: string[]
  roles: { id: string; name: string }[]
  is_super_admin: boolean
  is_initial_admin: boolean
  setup_required: boolean
  password_change_required: boolean
  email_verification_required: boolean
}

export type AuthResponse = {
  message?: string
  admin: AdminUser
}

export type LoginCredentials = {
  email: string
  password: string
  remember: boolean
}
