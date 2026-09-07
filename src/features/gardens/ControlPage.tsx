import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import { HarvestReadiness } from '../../components/HarvestReadiness'
import type { ControlRow } from '../../domain/types'
import { exportOwnerData, getControlV2 } from '../../lib/garden-api'
import { downloadControlCsv, downloadOwnerExport } from '../../lib/export-download'

export function ControlPage() {
  const [rows, setRows] = useState<ControlRow[] | null>(null); const [error, setError] = useState<string | null>(null); const [exporting, setExporting] = useState(false); const [exportMessage, setExportMessage] = useState<string | null>(null)
  const load = useCallback(async () => { setError(null); try { setRows(await getControlV2()) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo generar Control V2.') } }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loader writes after the RPC settles.
  useEffect(() => { void load() }, [load])
  const downloadData = async () => {
    setExporting(true); setExportMessage(null)
    try { downloadOwnerExport(await exportOwnerData()); setExportMessage('Datos descargados. El archivo incluye el manifiesto de originales, no enlaces ni credenciales.') }
    catch (reason) { setExportMessage(`No se pudo preparar la exportación: ${reason instanceof Error ? reason.message : 'Error desconocido.'}`) }
    finally { setExporting(false) }
  }
  return <AppShell title="Control V2" subtitle="Estado consultado ahora, sin IA" backTo="/"><p className="quiet-copy">Este informe usa posiciones, ciclos y Atención actuales. No infiere salud ni acciones realizadas.</p>{!rows && !error && <StatePanel kind="loading" title="Generando informe" />}{error && <StatePanel kind="error" title="No se pudo generar Control V2" onRetry={() => void load()}>{error}</StatePanel>}{rows && <><div className="control-export"><div><strong>Exportar tus datos</strong><p>Descarga un CSV del informe o un JSON de tus registros e historial. Una exportación no sustituye un backup.</p></div><div className="button-row"><button className="secondary-button secondary-button--compact" type="button" onClick={() => downloadControlCsv(rows)}><Download size={16} aria-hidden="true" /> CSV</button><button className="secondary-button secondary-button--compact" type="button" disabled={exporting} onClick={() => void downloadData()}><Download size={16} aria-hidden="true" /> {exporting ? 'Preparando…' : 'Datos JSON'}</button><Link className="secondary-button secondary-button--compact" to="/import">Importar historia</Link></div>{exportMessage && <p className="inline-message" role="status">{exportMessage}</p>}</div><div className="control-table">{rows.map((row) => <article key={row.position_id}><span className="control-table__number" aria-hidden="true">{String(row.position_number).padStart(2, '0')}</span><div><strong>{row.garden_name} · Posición {row.position_number}</strong><span>{row.crop_name ?? 'Vacía'}</span>{row.harvest_readiness && <HarvestReadiness value={row.harvest_readiness} />}{row.attention_count > 0 && <small>{row.attention_count} atención{row.attention_count === 1 ? '' : 'es'} abierta{row.attention_count === 1 ? '' : 's'}</small>}</div></article>)}</div></>}</AppShell>
}
