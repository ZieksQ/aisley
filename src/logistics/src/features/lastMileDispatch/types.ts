export type DispatchCourier = {
  courier_id: string
  name: string
  email: string
  contact_number: string | null
}
export type DispatchSchedule = {
  id: string
  reference: string
  status: string
  scheduled_for: string
  parcel_count: number
  courier: {
    id: string
    name: string
    email: string
    contact_number: string | null
  }
  parcels: Array<{
    shipment_id: string
    order_reference: string | null
    waybill_reference: string | null
    tracking_id: string | null
    sequence: number
    source_lane: { code: string; name: string } | null
  }>
}
