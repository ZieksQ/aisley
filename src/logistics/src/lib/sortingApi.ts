import { csrf, requestWithTimeout } from './api'

export type SortingMutationAttempt = { path: string; body: string; key: string }

/** Send the saved body and identity unchanged when verifying an uncertain outcome. */
export async function sortingMutation<T>(attempt: SortingMutationAttempt, method = 'POST'): Promise<T> {
  await csrf()
  return requestWithTimeout<T>(attempt.path, {
    method,
    headers: { 'Idempotency-Key': attempt.key },
    body: attempt.body,
  })
}

export function sortingExceptions<T>(page: number): Promise<T> {
  return requestWithTimeout<T>(`/api/v1/logistics/sorting/exceptions?page=${page}`)
}
