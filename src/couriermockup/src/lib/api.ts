import type { ApiErrorPayload } from '../types'

const configuredOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export const apiOriginLabel = configuredOrigin || 'Vite proxy → http://127.0.0.1:8000'

export class ApiError extends Error {
  readonly status: number
  readonly payload: ApiErrorPayload

  constructor(
    status: number,
    payload: ApiErrorPayload,
  ) {
    super(payload.message ?? 'The API request failed.')
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }

  get code(): string | undefined {
    return this.payload.code
  }

  get errors(): Record<string, string[]> {
    return this.payload.errors ?? {}
  }
}

function resolveUrl(path: string): string {
  return `${configuredOrigin}${path}`
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(resolveUrl(path), {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    headers,
  })
  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload

  if (!response.ok) {
    throw new ApiError(response.status, payload)
  }

  return payload as T
}
