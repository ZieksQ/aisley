import { apiPdfRequest } from './api'

export async function openWaybillPdf(path: string, mode: 'preview' | 'download' | 'print', filename: string) {
  const popup = mode === 'download' ? null : window.open('', '_blank')

  try {
    if (mode !== 'download' && !popup) throw new Error('Pop-up blocked')
    const blob = await apiPdfRequest(path)
    const objectUrl = URL.createObjectURL(blob)

    if (mode === 'download') {
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      return
    }

    if (!popup) throw new Error('Pop-up blocked')
    if (mode === 'print') popup.addEventListener('load', () => popup.print(), { once: true })
    popup.location.href = objectUrl
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000)
  } catch (error) {
    popup?.close()
    throw error
  }
}
