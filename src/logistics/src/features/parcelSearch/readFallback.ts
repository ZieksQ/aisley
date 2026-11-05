import { ApiError } from '../../lib/api'

export function canUseOffline(error: unknown) {
  return (
    !navigator.onLine ||
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status === 408 ||
    error.status >= 500
  )
}
