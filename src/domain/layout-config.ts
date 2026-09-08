import type { PhysicalSite } from './types'

export const MAP_GRID_COLUMNS = 8
export const MAP_GRID_ROWS = 9

export function activeGrowPositionIds(sites: PhysicalSite[]): Set<string> {
  return new Set(sites.filter((site) => site.site_kind === 'grow' && site.is_active && site.position_id).map((site) => site.position_id as string))
}

export function siteLabel(site: PhysicalSite): string {
  if (site.site_kind === 'grow') return site.position_number ? `Posición ${site.position_number}` : 'Posición de cultivo'
  return site.label?.trim() || 'Elemento técnico'
}

export function mapCoordinateIsValid(value: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= maximum
}
