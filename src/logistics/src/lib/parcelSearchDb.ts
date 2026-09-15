import Dexie, { type EntityTable } from 'dexie'
import { normalizeParcelReference } from './parcelBarcode'
import type { FulfillmentQueueResponse, FulfillmentShipment, FulfillmentTask } from '../types/fulfillment'

export type CachedParcelRecord = {
  id: string
  context: string
  shipmentId: string
  record: FulfillmentShipment
  detailed: boolean
  cachedAt: string
}

export type CachedParcelResult = {
  record: FulfillmentShipment
  detailed: boolean
  cachedAt: string
}

class ParcelSearchDatabase extends Dexie {
  records!: EntityTable<CachedParcelRecord, 'id'>

  constructor() {
    super('aisley-logistics-parcel-search')
    this.version(1).stores({ records: 'id, context, cachedAt' })
  }
}

export const parcelSearchDb = new ParcelSearchDatabase()

function cacheId(context: string, shipmentId: string): string {
  return `${context}:${shipmentId}`
}

function mergeTask(previous: FulfillmentTask | undefined, incoming: FulfillmentTask): FulfillmentTask {
  if (!previous) return incoming
  return {
    ...previous,
    ...incoming,
    evidence: incoming.evidence ?? previous.evidence,
    completion_intents: incoming.completion_intents ?? previous.completion_intents,
    offer_history: incoming.offer_history ?? previous.offer_history,
  }
}

function mergeRecord(previous: FulfillmentShipment | undefined, incoming: FulfillmentShipment): FulfillmentShipment {
  if (!previous) return incoming
  const previousTasks = new Map(previous.tasks.map((task) => [task.task_id, task]))
  return {
    ...previous,
    ...incoming,
    parcel: incoming.parcel ?? previous.parcel,
    tasks: incoming.tasks.length ? incoming.tasks.map((task) => mergeTask(previousTasks.get(task.task_id), task)) : previous.tasks,
  }
}

async function cacheParcel(context: string, record: FulfillmentShipment, detailed: boolean): Promise<void> {
  if (!context) return
  const id = cacheId(context, record.shipment_id)
  const existing = await parcelSearchDb.records.get(id)
  await parcelSearchDb.records.put({
    id,
    context,
    shipmentId: record.shipment_id,
    record: detailed ? record : mergeRecord(existing?.record, record),
    detailed: detailed || existing?.detailed === true,
    cachedAt: new Date().toISOString(),
  })
}

export async function cacheParcels(context: string, records: FulfillmentShipment[], detailed = false): Promise<void> {
  for (const record of records) await cacheParcel(context, record, detailed)
}

function searchableValues(record: FulfillmentShipment): string[] {
  return [
    record.shipment_id,
    record.parcel?.id,
    record.parcel?.reference,
    record.parcel?.order_reference,
    record.parcel?.waybill_reference,
  ].filter((value): value is string => Boolean(value))
}

function hasEvidenceStatus(record: FulfillmentShipment, status: string): boolean {
  return record.tasks.some((task) => task.evidence_status === status || task.evidence?.some((item) => item.status === status))
}

function matches(record: FulfillmentShipment, search: string, status: string, evidenceStatus: string): boolean {
  const normalizedSearch = normalizeParcelReference(search)
  const searchMatches = !normalizedSearch || searchableValues(record).some((value) => normalizeParcelReference(value).includes(normalizedSearch))
  return searchMatches && (!status || record.status === status) && (!evidenceStatus || hasEvidenceStatus(record, evidenceStatus))
}

function activityTime(result: CachedParcelRecord): number {
  return new Date(result.record.last_activity_at ?? result.cachedAt).getTime()
}

async function recordsForContext(context: string): Promise<CachedParcelRecord[]> {
  if (!context) return []
  return parcelSearchDb.records.where('context').equals(context).toArray()
}

export async function searchCachedParcels(context: string, search = '', status = '', evidenceStatus = ''): Promise<CachedParcelResult[]> {
  const rows = await recordsForContext(context)
  const unique = new Map<string, CachedParcelRecord>()
  for (const row of rows) {
    if (matches(row.record, search, status, evidenceStatus)) unique.set(row.shipmentId, row)
  }
  return [...unique.values()]
    .sort((left, right) => activityTime(right) - activityTime(left) || right.shipmentId.localeCompare(left.shipmentId))
    .map((row) => ({ record: row.record, detailed: row.detailed, cachedAt: row.cachedAt }))
}

export async function findCachedParcel(context: string, value: string): Promise<CachedParcelResult | null> {
  const normalizedValue = normalizeParcelReference(value)
  if (!normalizedValue) return null
  const rows = await recordsForContext(context)
  const result = rows
    .filter((row) => searchableValues(row.record).some((candidate) => normalizeParcelReference(candidate) === normalizedValue))
    .sort((left, right) => activityTime(right) - activityTime(left))[0]
  return result ? { record: result.record, detailed: result.detailed, cachedAt: result.cachedAt } : null
}

function isPendingEvidence(task: FulfillmentTask): boolean {
  return task.evidence_status === 'submitted' || task.evidence_status === 'awaiting_validation' || task.evidence?.some((item) => item.status === 'submitted' || item.status === 'awaiting_validation') === true
}

function summaryFor(records: CachedParcelResult[]): FulfillmentQueueResponse['summary'] {
  const byStatus: Record<string, number> = {}
  let pendingEvidence = 0
  let pendingCompletion = 0
  for (const item of records) {
    byStatus[item.record.status] = (byStatus[item.record.status] ?? 0) + 1
    if (item.record.tasks.some(isPendingEvidence)) pendingEvidence += 1
    if (item.record.tasks.some((task) => task.completion_status === 'awaiting_validation')) pendingCompletion += 1
  }
  return { total: records.length, by_status: byStatus, pending_evidence: pendingEvidence, pending_completion: pendingCompletion }
}

export async function readCachedQueue(context: string, search: string, status: string, evidenceStatus: string, page: number, perPage: number): Promise<FulfillmentQueueResponse | null> {
  const rows = await recordsForContext(context)
  if (!rows.length) return null
  const activeRows = rows.filter((row) => row.record.status !== 'delivered')
  const filtered = activeRows
    .filter((row) => matches(row.record, search, status, evidenceStatus))
    .sort((left, right) => activityTime(right) - activityTime(left) || right.shipmentId.localeCompare(left.shipmentId))
    .map((row) => ({ record: row.record, detailed: row.detailed, cachedAt: row.cachedAt }))
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage))
  const start = Math.max(0, (page - 1) * perPage)
  const pageRecords = filtered.slice(start, start + perPage).map((item) => item.record)
  const generatedAt = [...filtered].sort((left, right) => right.cachedAt.localeCompare(left.cachedAt))[0]?.cachedAt ?? new Date().toISOString()
  return {
    data: pageRecords,
    summary: summaryFor(filtered),
    meta: { current_page: page, last_page: lastPage, per_page: perPage, total: filtered.length },
    freshness: { generated_at: generatedAt, state: 'offline-cache' },
  }
}

export async function clearParcelSearchCache(): Promise<void> {
  await parcelSearchDb.records.clear()
}
