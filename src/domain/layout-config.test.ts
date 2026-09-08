import { describe, expect, it } from 'vitest'
import { activeGrowPositionIds, mapCoordinateIsValid, MAP_GRID_COLUMNS, MAP_GRID_ROWS, siteLabel } from './layout-config'

describe('mapas físicos configurables', () => {
  it('incluye únicamente los puntos de cultivo activos en el recorrido', () => {
    expect(activeGrowPositionIds([
      { id: 'a', position_id: 'p1', position_number: 1, site_kind: 'grow', is_active: true, grid_x: 1, grid_y: 1, label: null },
      { id: 'b', position_id: null, position_number: null, site_kind: 'utility', is_active: true, grid_x: 3, grid_y: 1, label: 'Llenado de agua' },
      { id: 'c', position_id: 'p2', position_number: 2, site_kind: 'grow', is_active: false, grid_x: 5, grid_y: 1, label: null },
    ])).toEqual(new Set(['p1']))
  })

  it('mantiene texto explícito para puntos técnicos y coordenadas válidas', () => {
    expect(siteLabel({ id: 'a', position_id: null, position_number: null, site_kind: 'utility', is_active: true, grid_x: 1, grid_y: 1, label: 'Llenado de agua' })).toBe('Llenado de agua')
    expect(mapCoordinateIsValid(1, MAP_GRID_COLUMNS)).toBe(true)
    expect(mapCoordinateIsValid(MAP_GRID_ROWS + 1, MAP_GRID_ROWS)).toBe(false)
  })
})
