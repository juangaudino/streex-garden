import type { User } from '@supabase/supabase-js'
import type { AttentionItem, AttentionPurpose, ControlProjection, ControlRow, CycleFactType, GardenCoverPhoto, GardenDetail, GardenSummary, GrowCycleDetail, HomeDashboard, ImportCandidate, MaintenanceSession, ObservationInput, PhotoEvidence, PhysicalSiteKind } from '../domain/types'
import { photoContentType, sha256Hex } from '../domain/photo-integrity'
import { getSupabaseClient } from './supabase'

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('El servidor no devolvió una respuesta válida.')
  return data
}

function withTimeout<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([operation, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function uploadOriginalBytes(path: string, contentType: string, bytes: ArrayBuffer): Promise<void> {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('Tu sesión expiró antes de subir la foto. Vuelve a iniciar sesión.')

  // storage-js 2.115 serializes a Blob as multipart with an empty field name.
  // This project rejects that payload as empty. Send the exact bytes to the
  // documented Storage object endpoint while retaining the user's JWT and RLS.
  const response = await withTimeout(fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/garden-originals/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${data.session.access_token}`,
        'content-type': contentType,
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: bytes,
    },
  ), 20_000, 'La carga de la foto tardó demasiado. Puedes reintentarla.')
  if (response.ok || response.status === 409) return
  const detail = await response.json().catch(() => null) as { message?: string } | null
  throw new Error(detail?.message ?? `Storage devolvió HTTP ${response.status}.`)
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getUser()
  if (error) throw new Error(error.message)
  return data.user
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function requestPasswordRecovery(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw new Error(error.message)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getHome(): Promise<GardenSummary[]> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_home')
  return unwrap(data as GardenSummary[] | null, error)
}

export async function getHomeDashboard(visitId: string | null): Promise<HomeDashboard> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_home_dashboard', { p_visit_id: visitId })
  return unwrap(data as HomeDashboard | null, error)
}

export async function acknowledgeHomeSnapshot(visitId: string, snapshotCursor: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_ack_home_snapshot', {
    p_visit_id: visitId,
    p_snapshot_cursor: snapshotCursor,
  })
  if (error) throw new Error(error.message)
}

export async function getAttention(): Promise<AttentionItem[]> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_attention')
  return unwrap(data as AttentionItem[] | null, error)
}

export async function createAttentionItem(input: {
  requestId: string
  gardenId: string | null
  growCycleId: string | null
  purpose: AttentionPurpose
  subjectKey?: string
  dueOn?: string | null
}): Promise<{ task_id: string; created: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('garden_create_attention_item', {
    p_request_id: input.requestId,
    p_garden_id: input.gardenId,
    p_grow_cycle_id: input.growCycleId,
    p_purpose: input.purpose,
    p_subject_key: input.subjectKey ?? 'general',
    p_due_on: input.dueOn ?? null,
  })
  return unwrap(data as { task_id: string; created: boolean } | null, error)
}

export async function deferAttentionItem(input: { requestId: string; taskId: string; nextReviewOn: string; reason?: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_defer_attention_item', {
    p_request_id: input.requestId, p_task_id: input.taskId, p_next_review_on: input.nextReviewOn, p_reason: input.reason ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function dismissAttentionItem(input: { requestId: string; taskId: string; reason: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_dismiss_attention_item', {
    p_request_id: input.requestId, p_task_id: input.taskId, p_reason: input.reason,
  })
  if (error) throw new Error(error.message)
}

export async function completeAttentionItem(input: { requestId: string; taskId: string; note?: string; reviewResult?: string | null }): Promise<{ task_id: string; event_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_complete_attention_item', {
    p_request_id: input.requestId, p_task_id: input.taskId, p_note: input.note ?? null, p_review_result: input.reviewResult ?? null,
  })
  return unwrap(data as { task_id: string; event_id: string } | null, error)
}

export async function startMaintenanceSession(requestId: string, gardenIds: string[]): Promise<{ session_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_start_maintenance_session', { p_request_id: requestId, p_garden_ids: gardenIds })
  return unwrap(data as { session_id: string } | null, error)
}
export async function getMaintenanceSession(sessionId: string): Promise<MaintenanceSession> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_maintenance_session', { p_session_id: sessionId })
  return unwrap(data as MaintenanceSession | null, error)
}
export async function getOpenMaintenanceSession(): Promise<{ id: string; state: 'in_progress' | 'paused'; started_at: string } | null> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_open_maintenance_session')
  if (error) throw new Error(error.message)
  return data as { id: string; state: 'in_progress' | 'paused'; started_at: string } | null
}
export async function progressMaintenancePosition(requestId: string, sessionPositionId: string, progress: 'reviewed' | 'skipped'): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_progress_maintenance_position', { p_request_id: requestId, p_session_position_id: sessionPositionId, p_progress: progress })
  if (error) throw new Error(error.message)
}
export async function setMaintenanceSessionState(requestId: string, sessionId: string, state: 'paused' | 'in_progress' | 'completed' | 'abandoned'): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_set_maintenance_session_state', { p_request_id: requestId, p_session_id: sessionId, p_state: state })
  if (error) throw new Error(error.message)
}
export async function getControlV2(referenceDate?: string): Promise<ControlProjection> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_control_v2', { p_reference_date: referenceDate ?? new Intl.DateTimeFormat('en-CA').format(new Date()) })
  return unwrap(data as ControlProjection | null, error)
}

/** Temporary reader for an older deployed Control V2 client only. */
export async function getControlV2Legacy(): Promise<ControlRow[]> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_control_v2')
  return unwrap(data as ControlRow[] | null, error)
}

export async function exportOwnerData(): Promise<unknown> {
  const { data, error } = await getSupabaseClient().rpc('garden_export_owner_data')
  return unwrap(data as unknown | null, error)
}

export async function getImportCandidates(): Promise<ImportCandidate[]> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_import_candidates')
  return unwrap(data as ImportCandidate[] | null, error)
}
export async function createImportBatch(input: { requestId: string; sourceLabel: string; sourceFingerprint: string; candidates: Array<{ candidate_key: string; candidate_type: 'observation' | 'recommendation' | 'conflict'; grow_cycle_id: string | null; occurred_on: string | null; occurred_on_precision: 'exact' | 'unknown'; note: string; source_data: Record<string, unknown> }> }): Promise<{ batch_id: string; created: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('garden_create_import_batch', { p_request_id: input.requestId, p_source_label: input.sourceLabel, p_source_fingerprint: input.sourceFingerprint, p_candidates: input.candidates })
  return unwrap(data as { batch_id: string; created: boolean } | null, error)
}
export async function reviewImportCandidate(input: { requestId: string; candidateId: string; decision: 'confirmed' | 'rejected'; decisionNote?: string }): Promise<{ candidate_id: string; decision: string; event_id: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('garden_review_import_candidate', { p_request_id: input.requestId, p_candidate_id: input.candidateId, p_decision: input.decision, p_decision_note: input.decisionNote ?? null })
  return unwrap(data as { candidate_id: string; decision: string; event_id: string | null } | null, error)
}
export async function updateImportCandidate(input: { requestId: string; candidateId: string; growCycleId: string; occurredOn: string }): Promise<{ candidate_id: string; updated: boolean }> {
  const { data, error } = await getSupabaseClient().rpc('garden_update_import_candidate', { p_request_id: input.requestId, p_candidate_id: input.candidateId, p_grow_cycle_id: input.growCycleId, p_occurred_on: input.occurredOn })
  return unwrap(data as { candidate_id: string; updated: boolean } | null, error)
}

export async function getGarden(gardenId: string): Promise<GardenDetail> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_garden', { p_garden_id: gardenId })
  return unwrap(data as GardenDetail | null, error)
}

export async function getGardenCoverPhotos(gardenId: string): Promise<GardenCoverPhoto[]> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_garden_cover_photos', { p_garden_id: gardenId })
  return unwrap(data as GardenCoverPhoto[] | null, error)
}

export async function setGardenCover(input: { requestId: string; gardenId: string; photoId: string | null }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_set_garden_cover', {
    p_request_id: input.requestId, p_garden_id: input.gardenId, p_photo_id: input.photoId,
  })
  if (error) throw new Error(error.message)
}

export async function getCycle(cycleId: string): Promise<GrowCycleDetail> {
  const { data, error } = await getSupabaseClient().rpc('garden_get_cycle', { p_grow_cycle_id: cycleId })
  return unwrap(data as GrowCycleDetail | null, error)
}

/** Records a confirmed, dated fact for the active cycle. It never infers a fact from a recommendation. */
export async function recordCycleFact(input: {
  requestId: string
  growCycleId: string
  factType: CycleFactType
  occurredOn: string
  note?: string
  factData?: Record<string, unknown>
}): Promise<{ event_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_record_cycle_fact', {
    p_request_id: input.requestId,
    p_grow_cycle_id: input.growCycleId,
    p_fact_type: input.factType,
    p_occurred_on: input.occurredOn,
    p_note: input.note ?? null,
    p_fact_data: input.factData ?? {},
  })
  return unwrap(data as { event_id: string } | null, error)
}

export async function createGarden(input: {
  requestId: string
  name: string
  systemModel: string
  positionCapacity: number
}): Promise<{ garden_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_create_garden', {
    p_request_id: input.requestId,
    p_name: input.name,
    p_system_model: input.systemModel,
    p_position_capacity: input.positionCapacity,
  })
  return unwrap(data as { garden_id: string } | null, error)
}

export async function addLayoutSite(input: { requestId: string; gardenId: string; gridX: number; gridY: number; siteKind: PhysicalSiteKind; label?: string }): Promise<{ site_id: string; position_id: string | null; position_number: number | null }> {
  const { data, error } = await getSupabaseClient().rpc('garden_add_layout_site', {
    p_request_id: input.requestId, p_garden_id: input.gardenId, p_grid_x: input.gridX, p_grid_y: input.gridY,
    p_site_kind: input.siteKind, p_label: input.label ?? null,
  })
  return unwrap(data as { site_id: string; position_id: string | null; position_number: number | null } | null, error)
}

export async function updateLayoutSite(input: { requestId: string; siteId: string; gridX: number; gridY: number; siteKind: PhysicalSiteKind; active: boolean; label?: string }): Promise<{ site_id: string; position_id: string | null; position_number: number | null }> {
  const { data, error } = await getSupabaseClient().rpc('garden_update_layout_site', {
    p_request_id: input.requestId, p_site_id: input.siteId, p_grid_x: input.gridX, p_grid_y: input.gridY,
    p_site_kind: input.siteKind, p_active: input.active, p_label: input.label ?? null,
  })
  return unwrap(data as { site_id: string; position_id: string | null; position_number: number | null } | null, error)
}

export async function startCycle(input: {
  requestId: string
  positionId: string
  cropName: string
  plantedOn: string | null
  plantedOnPrecision: 'exact' | 'approximate' | 'unknown'
}): Promise<{ grow_cycle_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_start_cycle', {
    p_request_id: input.requestId,
    p_position_id: input.positionId,
    p_crop_name: input.cropName,
    p_planted_on: input.plantedOn,
    p_planted_on_precision: input.plantedOnPrecision,
  })
  return unwrap(data as { grow_cycle_id: string } | null, error)
}

export async function recordHarvest(input: { requestId: string; growCycleId: string; expectedRevision: number; note: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_record_harvest', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_note: input.note || null })
  if (error) throw new Error(error.message)
}

export async function closeCycle(input: { requestId: string; growCycleId: string; expectedRevision: number; endedOn: string; reason: string; note: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_close_cycle', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_ended_on: input.endedOn, p_reason: input.reason, p_note: input.note || null })
  if (error) throw new Error(error.message)
}

export async function replaceCycle(input: { requestId: string; growCycleId: string; expectedRevision: number; cropName: string; plantedOn: string | null; plantedOnPrecision: 'exact' | 'approximate' | 'unknown' }): Promise<{ grow_cycle_id: string }> {
  const { data, error } = await getSupabaseClient().rpc('garden_replace_cycle', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_crop_name: input.cropName, p_planted_on: input.plantedOn, p_planted_on_precision: input.plantedOnPrecision })
  return unwrap(data as { grow_cycle_id: string } | null, error)
}

export async function moveCycle(input: { requestId: string; growCycleId: string; expectedRevision: number; targetPositionId: string; movedOn: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_move_cycle', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_target_position_id: input.targetPositionId, p_moved_on: input.movedOn })
  if (error) throw new Error(error.message)
}

export async function correctCyclePlanting(input: { requestId: string; growCycleId: string; expectedRevision: number; plantedOn: string | null; plantedOnPrecision: 'exact' | 'approximate' | 'unknown'; reason: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_correct_cycle_planting', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_planted_on: input.plantedOn, p_planted_on_precision: input.plantedOnPrecision, p_reason: input.reason })
  if (error) throw new Error(error.message)
}

export async function reopenCycle(input: { requestId: string; growCycleId: string; expectedRevision: number; reason: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_reopen_cycle', { p_request_id: input.requestId, p_grow_cycle_id: input.growCycleId, p_expected_revision: input.expectedRevision, p_reason: input.reason })
  if (error) throw new Error(error.message)
}

export async function invalidateEvent(input: { requestId: string; eventId: string; expectedRevision: number; reason: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc('garden_invalidate_event', { p_request_id: input.requestId, p_event_id: input.eventId, p_expected_revision: input.expectedRevision, p_reason: input.reason })
  if (error) throw new Error(error.message)
}

export interface CreatedObservation {
  eventId: string
  photoId?: string
  storagePath?: string
}

export async function createObservation(input: ObservationInput): Promise<CreatedObservation> {
  const client = getSupabaseClient()
  const originalBytes = input.photo ? await input.photo.arrayBuffer() : null
  if (originalBytes && originalBytes.byteLength === 0) {
    throw new Error('La foto seleccionada no contiene datos. El original quedó pendiente de reintento.')
  }
  const checksum = originalBytes ? await sha256Hex(originalBytes) : null
  const { data, error } = await client.rpc('garden_create_observation', {
    p_request_id: input.requestId,
    p_grow_cycle_id: input.growCycleId,
    p_note: input.note,
    p_original_filename: input.photoMetadata?.originalFilename ?? null,
    p_content_type: input.photoMetadata?.contentType ?? null,
    p_byte_size: input.photoMetadata?.byteSize ?? null,
    p_captured_at: null,
    p_captured_at_precision: 'unknown',
    p_checksum_sha256: checksum,
  })
  const response = unwrap(data as { event_id?: string; photo_id?: string; storage_path?: string } | null, error)
  if (!response.event_id) throw new Error('El servidor no devolvió el identificador de la observación.')
  const created: CreatedObservation = { eventId: response.event_id, photoId: response.photo_id, storagePath: response.storage_path }
  if (!input.photo || !response.photo_id || !response.storage_path) return created
  if (!originalBytes || !checksum) throw new Error('No se pudo preparar el original para su carga.')

  // Some mobile browsers hand a valid File to the page but fail to stream its
  // Blob body through fetch. Reading its bytes first preserves the original
  // payload and gives Storage a concrete request body.
  await uploadOriginalBytes(response.storage_path, input.photoMetadata?.contentType ?? input.photo.type, originalBytes)
  const confirmation = await withTimeout(Promise.resolve(client.rpc('garden_mark_photo_uploaded', {
    p_photo_id: response.photo_id,
    p_checksum_sha256: checksum,
    p_width: null,
    p_height: null,
  })), 10_000, 'La foto se subió, pero su confirmación tardó demasiado. Puedes reintentarla.')
  if (confirmation.error) throw new Error(`La foto se subió, pero no pudo confirmarse: ${confirmation.error.message}`)
  return created
}

export async function retryPendingPhoto(photo: PhotoEvidence, file: File): Promise<void> {
  if (photoContentType(file) !== photo.content_type || file.size !== photo.byte_size) {
    throw new Error('El archivo no coincide con la metadata del original pendiente. Selecciona exactamente la misma foto.')
  }
  const originalBytes = await file.arrayBuffer()
  if (originalBytes.byteLength !== photo.byte_size) {
    throw new Error('El archivo no conserva el tamaño original. Selecciona exactamente la misma foto.')
  }
  if (!photo.checksum_sha256) {
    throw new Error('Esta foto pendiente fue creada antes de la verificación de integridad. Registra nuevamente el original para no asociar una imagen equivocada.')
  }
  const checksum = await sha256Hex(originalBytes)
  if (checksum !== photo.checksum_sha256) {
    throw new Error('El archivo no coincide exactamente con el original pendiente. Selecciona la misma foto.')
  }
  await uploadOriginalBytes(photo.storage_path, photo.content_type, originalBytes)
  const confirmation = await withTimeout(Promise.resolve(getSupabaseClient().rpc('garden_mark_photo_uploaded', {
    p_photo_id: photo.id,
    p_checksum_sha256: checksum,
    p_width: null,
    p_height: null,
  })), 10_000, 'La foto se subió, pero su confirmación tardó demasiado. Puedes reintentarla.')
  if (confirmation.error) throw new Error(`La foto se subió, pero no pudo confirmarse: ${confirmation.error.message}`)
}

export async function getSignedPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await getSupabaseClient().storage.from('garden-originals').createSignedUrl(storagePath, 60 * 5)
  return unwrap(data?.signedUrl ?? null, error)
}
