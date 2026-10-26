/**
 * Handing a generated file to the browser.
 *
 * Kept out of `services/reports.ts` so that module stays pure HTTP: a service
 * that also clicks an anchor is a service whose requests cannot be tested
 * without a document. The download API is small and entirely a DOM concern.
 *
 * The object URL is revoked on the next task rather than immediately: some
 * browsers cancel a download whose blob has already been released by the time
 * the click is processed.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'

  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
