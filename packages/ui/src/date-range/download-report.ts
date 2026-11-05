export class ReportDownloadError extends Error {
  readonly status: number

  constructor(status: number) {
    super('The CSV could not be downloaded. Check your access and try again.')
    this.status = status
  }
}

export async function downloadReportCsv(url: string, filename: string, signal: AbortSignal) {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store', signal, headers: { Accept: 'text/csv' } })
  if (!response.ok) throw new ReportDownloadError(response.status)
  const blob = await response.blob()
  if (signal.aborted) return
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
