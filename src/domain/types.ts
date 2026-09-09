export type DatePrecision = 'exact' | 'approximate' | 'unknown'
export type HarvestReadiness = 'not_yet' | 'evaluate' | 'ready' | 'not_applicable'
export type DraftStatus = 'draft' | 'queued' | 'syncing' | 'synced' | 'retryable_error' | 'needs_review'
export type PhotoContentType = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif' | 'image/webp'
export type CycleState = 'active' | 'closed'
export type CycleEventType = 'observation' | 'planting' | 'harvest' | 'action' | 'cycle_started' | 'cycle_ended' | 'cycle_moved' | 'seeds_added' | 'germination_observed' | 'germination_confirmed' | 'plant_count_observed' | 'visual_review' | 'development_review' | 'intervention' | 'incident_opened' | 'incident_resolved' | 'system_maintenance' | 'measurement' | 'readiness_review'
export type MapLayout = 'provisional_list' | 'uruq_8_v1' | 'uruq_12_v1' | 'custom_grid'
export type PhysicalSiteKind = 'grow' | 'utility'

export interface GardenSummary {
  id: string
  name: string
  system_model: string | null
  position_capacity: number
  map_layout: MapLayout
  active_positions: number
  cover_photo?: PhotoEvidence | null
}

export type AttentionOrigin = 'manual' | 'rule' | 'follow_up' | 'visual_review' | 'incident' | 'ai_proposal'
export type AttentionPurpose =
  | 'evaluate_visual_review' | 'evaluate_thinning' | 'evaluate_pruning' | 'evaluate_support'
  | 'perform_thinning' | 'perform_pruning' | 'perform_support' | 'perform_harvest'
  | 'perform_support_remove'
  | 'perform_water_change' | 'perform_refill' | 'perform_nutrients' | 'perform_cleaning'

export interface HomeChange {
  cursor: number
  kind: 'event' | 'correction' | 'attention'
  garden_id: string | null
  grow_cycle_id: string | null
  occurred_at: string
  committed_at: string
  summary: string
}

export interface AttentionItem {
  id: string
  garden_id: string | null
  garden_name?: string | null
  grow_cycle_id: string | null
  /** Derived from the active occupancy only for a cycle-scoped task. */
  position_id?: string | null
  position_number?: number | null
  crop_name?: string | null
  purpose: AttentionPurpose
  subject_key: string
  title: string
  origin: AttentionOrigin
  due_on: string | null
  next_review_on: string | null
  created_at: string
}

export interface HomeDashboard {
  visit: {
    id: string
    base_cursor: number
    snapshot_cursor: number
    snapshot_at: string
    first_visit: boolean
    visit_gap_minutes: number
  }
  gardens: GardenSummary[]
  since_last_time: { changes: HomeChange[] }
  attention: { items: AttentionItem[] }
}

export interface MaintenancePosition {
  id: string
  garden_id: string
  garden_name: string
  position_id: string
  position_number: number
  captured_grow_cycle_id: string | null
  current_grow_cycle_id: string | null
  crop_name: string | null
  progress: 'not_reviewed' | 'reviewed' | 'skipped'
  ordinal: number
}
export interface MaintenanceSession { id: string; state: 'in_progress' | 'paused' | 'completed' | 'abandoned'; started_at: string; cursor_position: number; positions: MaintenancePosition[] }
export interface ControlEvidence { event_id: string; occurred_on: string | null; note: string | null; [key: string]: unknown }
export interface ControlAction { task_id: string; purpose: AttentionPurpose; title: string; due_on: string | null; next_review_on: string | null; origin: AttentionOrigin }
export interface ControlPosition {
  position: { id: string; number: number }
  grow_cycle_id: string | null
  plant: { name: string | null } | null
  planting: { date: string | null; precision: DatePrecision | null } | null
  age: { days: number | null; status: 'known' | 'unknown' | 'outside_reference_date'; precision: DatePrecision | null }
  last_thinning: ControlEvidence | null
  next_thinning_evaluation: { kind: 'pending' | 'evaluate_today' | 'scheduled' | 'evaluate' | 'not_required' | 'not_scheduled'; task: ControlAction | null; evidence: ControlEvidence | null }
  harvest_readiness: { value: HarvestReadiness; reason: string | null; evidence: ControlEvidence | null } | null
  current_state: { kind: 'reassuring' | 'watch' | 'action_required' | 'insufficient_evidence'; evidence: ControlEvidence | null; reason: string | null; change_after_evidence?: ControlEvidence } | null
  germination: { status: 'confirmed' | 'no_observation'; evidence: ControlEvidence | null } | null
  seed_count?: { count: number | null; count_min: number | null; count_precision: 'exact' | 'minimum' | 'unknown'; event_id?: string; occurred_on?: string | null; note?: string | null } | null
  plant_count: ControlEvidence | null
  action: ControlAction | null
}
export interface ControlGarden {
  garden_id: string
  garden_name: string
  summary: Partial<Record<'todo_bien' | 'pendiente_vigilar' | 'requiere_atencion' | 'sin_evaluacion_suficiente', { count: number; positions: number[] }>>
  germination_coverage: { occupied_positions: number; confirmed_positions: number }
  shared_actions: ControlAction[]
  relevant_facts: Array<ControlEvidence & { event_type: CycleEventType }>
  positions: ControlPosition[]
}
export interface ControlProjection {
  reference_date: string
  interpretation: string
  gardens: ControlGarden[]
  positions: ControlPosition[]
}
/** Compatibility shape retained for pre-GX-00 CSV consumers. */
export interface ControlRow { garden_id: string; garden_name: string; position_id: string; position_number: number; grow_cycle_id: string | null; crop_name: string | null; planted_on: string | null; harvest_readiness: HarvestReadiness | null; attention_count: number }
export interface ImportCandidate { id: string; batch_id: string; source_label: string; candidate_key: string; candidate_type: 'observation' | 'recommendation' | 'conflict'; grow_cycle_id: string | null; occurred_on: string | null; occurred_on_precision: 'exact' | 'unknown'; note: string; source_data: Record<string, unknown>; decision: 'pending' | 'confirmed' | 'rejected'; decision_note: string | null; confirmed_event_id: string | null; created_at: string; decided_at: string | null }

export interface GrowCycleSummary {
  id: string
  crop_name: string
  planted_on: string | null
  planted_on_precision: DatePrecision
  harvest_readiness: HarvestReadiness
  photo?: PhotoEvidence | null
}

export interface Position {
  id: string
  position_number: number
  current_cycle: GrowCycleSummary | null
  previous_cycles: PreviousCycle[]
}

/** A point on the actual equipment. It can be a planting space or a technical element. */
export interface PhysicalSite {
  id: string
  position_id: string | null
  position_number: number | null
  site_kind: PhysicalSiteKind
  is_active: boolean
  grid_x: number
  grid_y: number
  label: string | null
}

export interface PreviousCycle extends GrowCycleSummary {
  state: CycleState
  last_occupied_on: string | null
}

export interface GardenDetail extends Omit<GardenSummary, 'active_positions'> {
  positions: Position[]
  layout_sites: PhysicalSite[]
}

export interface PhotoEvidence {
  id: string
  storage_path: string
  original_filename: string
  content_type: PhotoContentType
  byte_size: number
  checksum_sha256: string | null
  captured_at: string | null
  captured_at_precision: DatePrecision
  upload_status: 'pending' | 'uploaded' | 'failed'
}

export interface GardenCoverPhoto extends PhotoEvidence {
  event_id: string
  event_type: CycleEventType
  is_cover: boolean
}

export interface CycleHistoryEvent {
  id: string
  event_type: CycleEventType
  occurred_at: string
  occurred_at_precision?: 'timestamp' | 'date'
  occurred_on?: string | null
  note: string | null
  event_data?: Record<string, unknown>
  revision: number
  photo: PhotoEvidence | null
}

export type CycleFactType = 'germination_observed' | 'plant_count_observed' | 'visual_review' | 'development_review' | 'readiness_review' | 'intervention' | 'incident_opened' | 'incident_resolved'

export interface GrowCycleDetail extends GrowCycleSummary {
  state: CycleState
  revision: number
  position: Pick<Position, 'id' | 'position_number'>
  garden: Pick<GardenSummary, 'id' | 'name'>
  history: CycleHistoryEvent[]
  corrections: Array<{ id: string; operation: string; revision: number; reason: string; created_at: string }>
}

export interface ObservationInput {
  requestId: string
  growCycleId: string
  note: string
  photo?: Blob
  photoMetadata?: {
    originalFilename: string
    contentType: PhotoContentType
    byteSize: number
  }
}

export interface ObservationDraft extends ObservationInput {
  id: string
  createdAt: string
  status: DraftStatus
  lastError?: string
}
