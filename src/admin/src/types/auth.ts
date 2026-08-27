export type AdminProfile = {
  first_name: string | null
  last_name: string | null
  profile_photo_path: string | null
}

export type AdminUser = {
  id: string
  email: string
  role: 'admin'
  status: 'active'
  profile: AdminProfile | null
  permissions: string[]
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
