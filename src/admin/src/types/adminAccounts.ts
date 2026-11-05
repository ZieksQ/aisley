export type PermissionDefinition = { slug: string; name: string; description: string }
export type AdminRole = {
  id: string
  name: string
  permissions: string[]
  member_count: number
  revision: number
}
export type ManagedAdmin = {
  id: string
  email: string
  status: 'active' | 'suspended' | 'deactivated'
  profile: {
    first_name: string
    middle_name: string | null
    last_name: string
    contact_number: string | null
  } | null
  is_super_admin: boolean
  is_initial_admin: boolean
  archived_at: string | null
  setup_required: boolean
  permissions: string[]
  direct_permissions: string[]
  roles: AdminRole[]
  revision: number
}
export type AdminAccountDraft = {
  email: string
  first_name: string
  middle_name: string
  last_name: string
  contact_number: string
  permissions: string[]
  role_ids: string[]
  is_super_admin: boolean
  current_password: string
  password?: string
  password_confirmation?: string
  revision?: number
}
export type SetupChallenge = {
  challenge_id: string
  masked_email: string
  expires_at: string
  resend_available_at: string
}
