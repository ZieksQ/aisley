import Dexie, { type EntityTable } from 'dexie'

export type PendingSortCapture = {
  id: string
  context: string
  sessionId: string
  laneId: string | null
  autoRoute: boolean
  reference: string
  expectedRevision: number
  source: 'barcode' | 'manual'
  capturedAt: string
  exceptionCode?: 'damaged' | 'unreadable_label' | 'destination_unclear' | 'other'
  reason?: string
  error?: string
}

class SortingDatabase extends Dexie {
  captures!: EntityTable<PendingSortCapture, 'id'>

  constructor() {
    super('aisley-logistics-sorting')
    this.version(1).stores({ captures: 'id, context, sessionId, capturedAt, &[context+sessionId+reference]' })
  }
}

export const sortingDb = new SortingDatabase()
