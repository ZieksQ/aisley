import type { Request } from './types'

export function financeClient(prefix: string, request: Request) {
  return {
    read: <T>(path: string, signal?: AbortSignal) => request<T>(`${prefix}${path}`, { signal }),
    write: <T>(path: string, body: unknown, method = 'POST') => request<T>(`${prefix}${path}`, { method, body: JSON.stringify(body) }),
  }
}

export async function downloadPdf(url: string, filename: string) {
  const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/pdf' } })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(payload.message ?? 'Document could not be downloaded. Try again.')
  }
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}
