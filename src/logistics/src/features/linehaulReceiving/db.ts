import Dexie, { type EntityTable } from 'dexie'
import type { PendingCapture, ReceivingDetail } from './types'

class LinehaulReceivingDatabase extends Dexie {
  captures!: EntityTable<PendingCapture, 'client_id'>
  manifests!: EntityTable<{ scope: string; detail: ReceivingDetail }, 'scope'>
  constructor() {
    super('aisley-linehaul-receiving')
    this.version(1).stores({ captures: 'client_id, scope, &[scope+reference]', manifests: 'scope' })
  }
}
export const linehaulReceivingDb = new LinehaulReceivingDatabase()
export async function clearLinehaulReceiving() {
  await linehaulReceivingDb.transaction('rw', linehaulReceivingDb.captures, linehaulReceivingDb.manifests, async () => {
    await linehaulReceivingDb.captures.clear()
    await linehaulReceivingDb.manifests.clear()
  })
}
