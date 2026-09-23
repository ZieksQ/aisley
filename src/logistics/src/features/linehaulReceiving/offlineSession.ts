import type { LogisticsUser } from '../../types/auth'

const identityKey = 'aisley-receiving-session'
const consentKey = 'aisley-receiving-consent'

export function isReceivingRoute() {
  return ['/receive-at-hub', '/inbound-linehaul'].includes(window.location.pathname) && !!new URLSearchParams(window.location.search).get('trip')
}

export function rememberReceivingSession(user: LogisticsUser) {
  // This is offline display/capture context only. Every sync still authenticates with Sanctum.
  try {
    sessionStorage.setItem(identityKey, JSON.stringify({ ...user, email: '', profile: null }))
  } catch { /* Storage restrictions leave online operation available. */ }
}

export function offlineReceivingSession(): LogisticsUser | null {
  if (navigator.onLine || !isReceivingRoute()) return null
  try {
    const user = JSON.parse(sessionStorage.getItem(identityKey) ?? 'null') as LogisticsUser | null
    return user?.role === 'logistics' && user.status === 'active' && user.organization?.hub && sessionStorage.getItem(consentKey) === user.id ? user : null
  } catch { return null }
}

export function rememberReceivingConsent(userId: string, accepted: boolean) {
  try { if (accepted) sessionStorage.setItem(consentKey, userId); else sessionStorage.removeItem(consentKey) } catch { /* Online remains available. */ }
}

export function clearReceivingSession() {
  try { sessionStorage.removeItem(identityKey); sessionStorage.removeItem(consentKey) } catch { /* No stored context to clear. */ }
}
