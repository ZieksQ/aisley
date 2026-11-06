import type { SetupGuideSnapshot } from '@aisley/ui/portal'
import { request } from '../../lib/api'

export function fetchSetupGuide(signal: AbortSignal) {
  return request<SetupGuideSnapshot>('/api/v1/logistics/setup-guide', { signal, cache: 'no-store' })
}
