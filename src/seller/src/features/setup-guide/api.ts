import type { SetupGuideSnapshot } from '@aisley/ui/portal'
import { apiRequest } from '../../lib/api'

export function fetchSetupGuide(signal: AbortSignal) {
  return apiRequest<SetupGuideSnapshot>('/api/v1/seller/setup-guide', { signal, cache: 'no-store' })
}
