import type { ControlProjection } from '../domain/types'
import type { ObservationDraft } from '../domain/types'

function timestampForFilename(value = new Date()): string {
  return value.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadOwnerExport(data: unknown): void {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), `streex-garden-datos-${timestampForFilename()}.json`)
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value)
  return `"${raw.replaceAll('"', '""')}"`
}

export function downloadControlCsv(projection: ControlProjection): void {
  const header = ['fecha_referencia', 'jardin', 'posicion', 'cultivo', 'fecha_siembra', 'precision_siembra', 'edad_dias', 'ultimo_raleo', 'proximo_raleo_evaluacion', 'preparacion_cosecha', 'estado', 'accion_pendiente', 'germinacion', 'conteo_plantas']
  const content = projection.gardens.flatMap((garden) => garden.positions.map((row) => [
    projection.reference_date, garden.garden_name, row.position.number, row.plant?.name ?? null,
    row.planting?.date ?? null, row.planting?.precision ?? null, row.age.days,
    row.last_thinning?.occurred_on ?? null, row.next_thinning_evaluation.kind,
    row.harvest_readiness?.value ?? null, row.current_state?.kind ?? null,
    row.action?.title ?? null, row.germination?.status ?? null,
    row.plant_count?.count === undefined || row.plant_count?.count === null ? null : String(row.plant_count.count),
  ].map(csvCell).join(','))).join('\r\n')
  download(new Blob([[header.join(','), content].filter(Boolean).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `streex-garden-control-${timestampForFilename()}.csv`)
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el original pendiente.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

export async function downloadObservationDrafts(drafts: ObservationDraft[]): Promise<void> {
  const serializable = await Promise.all(drafts.map(async ({ photo, ...draft }) => ({
    ...draft,
    photo: photo ? { encoding: 'data-url', content_type: photo.type, value: await blobAsDataUrl(photo) } : null,
  })))
  download(new Blob([JSON.stringify({ format_version: 'streex-garden-drafts/v1', exported_at: new Date().toISOString(), drafts: serializable }, null, 2)], { type: 'application/json;charset=utf-8' }), `streex-garden-borradores-${timestampForFilename()}.json`)
}
