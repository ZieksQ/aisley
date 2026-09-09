export type PickupAddress = {
  id: string
  label: string | null
  recipient_name: string
  contact_number: string
  address_line_1: string
  address_line_2: string | null
  barangay: string
  city_municipality: string
  province: string
  region: string
  postal_code: string
  country: string
  latitude: string | null
  longitude: string | null
  is_default: boolean
}

export type PickupAddressPayload = Omit<PickupAddress, 'id' | 'latitude' | 'longitude'> & {
  latitude: number | null
  longitude: number | null
}
