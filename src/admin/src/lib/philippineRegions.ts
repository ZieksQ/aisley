import regionIndex from '@aisley/psgc-address-data/data/list-of-all-regions.json'

type RegionIndexItem = {
  psgc_code: string
  name: string
}

export const philippineRegions = (regionIndex as RegionIndexItem[]).map(({ name, psgc_code }) => ({
  code: psgc_code,
  name,
}))

export type PhilippineRegion = (typeof philippineRegions)[number]

export const regionShortNames: Record<string, string> = {
  '0100000000': 'Ilocos',
  '0200000000': 'Cagayan Valley',
  '0300000000': 'Central Luzon',
  '0400000000': 'CALABARZON',
  '0500000000': 'Bicol',
  '0600000000': 'Western Visayas',
  '0700000000': 'Central Visayas',
  '0800000000': 'Eastern Visayas',
  '0900000000': 'Zamboanga Peninsula',
  '1000000000': 'Northern Mindanao',
  '1100000000': 'Davao',
  '1200000000': 'SOCCSKSARGEN',
  '1300000000': 'NCR',
  '1400000000': 'CAR',
  '1600000000': 'Caraga',
  '1700000000': 'MIMAROPA',
  '1800000000': 'Negros Island',
  '1900000000': 'BARMM',
}
