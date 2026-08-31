const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

type ErrorPayload = {
  code?: string
  message?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly errors: Record<string, string[]>

  constructor(status: number, payload: ErrorPayload) {
    super(payload.message ?? 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.errors = payload.errors ?? {}
  }
}

function url(path: string) {
  return `${apiBaseUrl}${path}`
}

function csrfToken() {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('XSRF-TOKEN='))

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null
}

export async function initializeCsrf() {
  const response = await fetch(url('/sanctum/csrf-cookie'), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new ApiError(response.status, { message: 'Unable to start a secure session.' })
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const token = csrfToken()
  if (token) {
    headers.set('X-XSRF-TOKEN', token)
  }

  const response = await fetch(url(path), {
    ...options,
    credentials: 'include',
    headers,
  })

  const payload = (await response.json().catch(() => ({}))) as ErrorPayload & T

  if (!response.ok) {
    throw new ApiError(response.status, payload)
  }

  return payload
}

export async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(url(path), {
    credentials: 'include',
    headers: { Accept: 'image/jpeg,image/png,image/webp' },
  })

  if (!response.ok) {
    throw new ApiError(response.status, { message: 'Unable to load the image.' })
  }

  return response.blob()
}

export function readableAuthError(error: ApiError): string {
  if (error.code === 'ACCOUNT_PENDING_APPROVAL') {
    return 'Your Seller application is still waiting for Admin approval.'
  }
  if (error.code === 'ACCOUNT_REJECTED') {
    return 'Your Seller application was not approved. Contact support if you need help.'
  }
  if (error.code === 'ACCOUNT_SUSPENDED') {
    return 'This Seller account is suspended. Contact support before trying again.'
  }
  if (error.code === 'ACCOUNT_INACTIVE') {
    return 'This Seller account is not active.'
  }
  if (error.status === 419) {
    return 'Your secure session expired. Refresh the page and try again.'
  }

  return error.errors.email?.[0] ?? error.message
}
