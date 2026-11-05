import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import { fetchComplianceOptions } from '../../lib/sellerCompliance'
import type { ComplianceOptionsResponse } from '../../types/sellerCompliance'

export function useComplianceOptions(query: string) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{
    key: string
    data: ComplianceOptionsResponse['data'] | null
    error: string | null
    loading: boolean
  }>({ key: '', data: null, error: null, loading: true })

  useEffect(() => {
    const controller = new AbortController()
    setState({ key: query, data: null, error: null, loading: true })
    fetchComplianceOptions(new URLSearchParams(query), controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setState({ key: query, data: response.data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setState({
          key: query, data: null, loading: false,
          error: error instanceof ApiError && error.status === 403
            ? 'You do not have permission to select Sellers for compliance review.'
            : error instanceof Error ? error.message : 'Unable to load compliance options.',
        })
      })
    return () => controller.abort()
  }, [query, retry, admin?.id, logout, navigate])

  return {
    data: state.key === query ? state.data : null,
    error: state.key === query ? state.error : null,
    loading: state.key !== query || state.loading,
    reload: () => setRetry((value) => value + 1),
  }
}
