import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'

export function useCourierAccess() {
  const { updateSeller } = useAuth()
  const navigate = useNavigate()
  return useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) return false
    if (error.status === 401) {
      updateSeller(null)
      navigate('/login', { replace: true })
    } else if (error.code === 'POLICY_CONSENT_REQUIRED') {
      navigate('/policy-consent', { replace: true })
    }
    return true
  }, [updateSeller, navigate])
}

export function courierError(error: unknown) {
  return error instanceof ApiError ? error.errors.body?.[0] ?? error.message : 'The API could not be reached. Check your connection and retry.'
}
