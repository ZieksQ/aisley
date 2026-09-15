export type DecodedParcelBarcode = {
  raw: string
  format: 'aisley-waybill-qr' | 'aisley-parcel-qr' | 'structured' | 'reference'
  reference: string | null
  waybillReference: string | null
  orderReference: string | null
  parcelReference: string | null
  parcelId: string | null
  shipmentId: string | null
  status: string | null
  itemCount: number | null
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const result = stringValue(value)
    if (result) return result
  }
  return null
}

function itemCountValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
  return null
}

export function normalizeParcelReference(value: string): string {
  const trimmed = value.trim()
  const qrMatch = trimmed.match(/^AISLEY:(?:WB|PARCEL):\d+:(.+)$/i)
  return (qrMatch?.[1] ?? trimmed).trim().toUpperCase()
}

function baseBarcode(raw: string, format: DecodedParcelBarcode['format'], values: Partial<DecodedParcelBarcode>): DecodedParcelBarcode {
  const reference = values.reference ? normalizeParcelReference(values.reference) : null
  return {
    raw,
    format,
    reference,
    waybillReference: values.waybillReference ? normalizeParcelReference(values.waybillReference) : null,
    orderReference: values.orderReference ? normalizeParcelReference(values.orderReference) : null,
    parcelReference: values.parcelReference ? normalizeParcelReference(values.parcelReference) : null,
    parcelId: values.parcelId ?? null,
    shipmentId: values.shipmentId ?? null,
    status: values.status ?? null,
    itemCount: values.itemCount ?? null,
  }
}

/**
 * Decode the local information carried by a waybill barcode/QR value.
 * Encoded status is informational only; the API response remains authoritative.
 */
export function decodeParcelBarcode(value: string): DecodedParcelBarcode {
  const raw = value.trim()
  const qrMatch = raw.match(/^AISLEY:WB:\d+:(.+)$/i)
  if (qrMatch) return baseBarcode(raw, 'aisley-waybill-qr', { reference: qrMatch[1], waybillReference: qrMatch[1] })

  const parcelQrMatch = raw.match(/^AISLEY:PARCEL:\d+:(.+)$/i)
  if (parcelQrMatch) return baseBarcode(raw, 'aisley-parcel-qr', { reference: parcelQrMatch[1], parcelReference: parcelQrMatch[1] })

  if (raw.startsWith('{')) {
    try {
      const payload = asRecord(JSON.parse(raw))
      if (payload) {
        const parcel = asRecord(payload.parcel)
        const waybill = asRecord(payload.waybill)
        const order = asRecord(payload.order)
        const waybillReference = firstString(payload.waybill_reference, payload.waybillReference, waybill?.reference)
        const orderReference = firstString(payload.order_reference, payload.orderReference, order?.reference)
        const parcelReference = firstString(payload.parcel_reference, payload.parcelReference, parcel?.reference)
        const parcelId = firstString(payload.parcel_id, payload.parcelId, parcel?.id)
        const shipmentId = firstString(payload.shipment_id, payload.shipmentId)
        const reference = firstString(waybillReference, orderReference, parcelReference, payload.reference, parcelId, shipmentId)
        return baseBarcode(raw, 'structured', {
          reference,
          waybillReference,
          orderReference,
          parcelReference,
          parcelId,
          shipmentId,
          status: firstString(payload.status, payload.shipment_status, payload.shipmentStatus),
          itemCount: itemCountValue(payload.item_count ?? payload.itemCount ?? parcel?.item_count ?? parcel?.itemCount),
        })
      }
    } catch {
      // A plain reference that happens to begin with `{` still gets the manual fallback below.
    }
  }

  return baseBarcode(raw, 'reference', { reference: raw })
}
