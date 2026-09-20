import regionsIndex from '@aisley/psgc-address-data/data/list-of-all-regions.json'

type Node = { name: string; psgc_code: string; geographic_level: string; children?: Node[] }
type Payload = { region: Node }
type RegionIndex = { name: string; psgc_code: string; file: string }
export type Option = { code: string; name: string }

const modules = import.meta.glob<Payload>('../../../packages/psgc-address-data/data/*/addresses.json')
const index = regionsIndex as RegionIndex[]

function options(nodes: Node[], levels: string[]): Option[] {
  return nodes.filter((node) => levels.includes(node.geographic_level)).map((node) => ({ code: node.psgc_code, name: node.name })).sort((a, b) => a.name.localeCompare(b.name))
}

export const regions: Option[] = index.map((entry) => ({ code: entry.psgc_code, name: entry.name })).sort((a, b) => a.name.localeCompare(b.name))

export async function regionTree(code: string): Promise<Node> {
  const entry = index.find((item) => item.psgc_code === code)
  if (!entry) throw new Error('Select a valid region.')
  const loader = modules[`../../../packages/psgc-address-data/data/${entry.file}`]
  if (!loader) throw new Error('Region address data is unavailable.')
  const payload = await loader()
  return payload.region
}

export function provinces(region: Node): Option[] { return options(region.children ?? [], ['province']) }

export function municipalities(region: Node, provinceCode: string): Option[] {
  const parent = (region.children ?? []).find((node) => node.psgc_code === provinceCode) ?? region
  return options(parent.children ?? [], ['city', 'municipality'])
}

export function barangays(region: Node, provinceCode: string, municipalityCode: string): Option[] {
  const parent = (region.children ?? []).find((node) => node.psgc_code === provinceCode) ?? region
  const municipality = (parent.children ?? []).find((node) => node.psgc_code === municipalityCode)
  const found: Node[] = []
  function visit(node: Node) {
    for (const child of node.children ?? []) {
      if (child.geographic_level === 'barangay') found.push(child)
      else visit(child)
    }
  }
  if (municipality) visit(municipality)
  return options(found, ['barangay'])
}
