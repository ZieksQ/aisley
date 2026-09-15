import Dexie, { type EntityTable } from 'dexie'

export type PendingReceipt = {
  id: string
  reference: string
  scannedAt: string
  source: 'barcode' | 'manual'
  error?: string
}

class ReceivingDatabase extends Dexie {
  receipts!: EntityTable<PendingReceipt, 'id'>

  constructor() {
    super('aisley-logistics-receiving')
    this.version(1).stores({ receipts: 'id, &reference, scannedAt' })
  }
}

export const receivingDb = new ReceivingDatabase()
