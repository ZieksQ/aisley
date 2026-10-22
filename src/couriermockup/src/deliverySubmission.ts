import type { Completion, EvidenceReceipt, FinalMileTask } from './finalMileTypes'
import { request } from './lib/api'

export type DeliverySubmission = {
  taskId: string
  revision: number
  photo: File | null
  proofId: string | null
  uploadKey: string
  completionKey: string
  codCollected: boolean
}

export function newDeliverySubmission(task: FinalMileTask, photo: File | null, proofId: string | null, codCollected: boolean): DeliverySubmission {
  return {
    taskId: task.task_id, revision: task.revision, photo, proofId: photo ? null : proofId,
    uploadKey: crypto.randomUUID(), completionKey: crypto.randomUUID(), codCollected,
  }
}

export async function submitDelivery(attempt: DeliverySubmission, token: string, stage: (message: string) => void) {
  if (!attempt.proofId && attempt.photo) {
    stage('Uploading parcel photo…')
    const form = new FormData()
    form.set('photo', attempt.photo)
    form.set('expected_revision', String(attempt.revision))
    const receipt = await request<{ data: EvidenceReceipt }>(`/api/v1/courier/tasks/${attempt.taskId}/proof-of-delivery`, {
      method: 'POST', headers: { 'Idempotency-Key': attempt.uploadKey }, body: form,
    }, token)
    if (!receipt.data.proof_id) throw new Error('The photo upload did not return a proof. Retry Delivered.')
    attempt.proofId = receipt.data.proof_id
  }
  if (!attempt.proofId) throw new Error('Take a parcel photo before submitting Delivered.')
  stage('Submitting delivery…')
  try {
    return (await request<{ data: Pick<Completion, 'intent_id' | 'task_status' | 'completion_status'> }>(`/api/v1/courier/tasks/${attempt.taskId}/completion`, {
      method: 'POST', headers: { 'Idempotency-Key': attempt.completionKey },
      body: JSON.stringify({
        evidence_id: attempt.proofId, expected_revision: attempt.revision, confirmed: true,
        ...(attempt.codCollected ? { cod_collected: true } : {}),
      }),
    }, token)).data
  } catch (caught) {
    // A lost response may already have queued the delivery. Reconcile before retrying.
    const current = await request<{ data: Completion }>(`/api/v1/courier/tasks/${attempt.taskId}/completion`, {}, token).catch(() => null)
    if (current?.data.intent_evidence_id === attempt.proofId
      && ['awaiting_validation', 'validated'].includes(current.data.completion_status ?? '')) return current.data
    throw caught
  }
}
