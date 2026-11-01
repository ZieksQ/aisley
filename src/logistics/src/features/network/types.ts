export type Connection = {
  id: string
  from_hub_id: string
  to_hub_id: string
  from_hub?: { name: string }
  to_hub?: { name: string }
  sender_requested: boolean
  receiver_accepted: boolean
  is_active: boolean
  revision: number
}
export type NetworkOverview = {
  enabled: boolean
  hubs: {
    id: string
    name: string
    business_name: string
    city_municipality: string | null
    province: string | null
  }[]
  hub_directory: { current_page: number; last_page: number; total: number }
  connections: Connection[]
  incoming_connections: Connection[]
}
