export const GARDEN_AI_STANDARD_VERSION = 'garden_ai_standard_v1' as const
export const GARDEN_AI_CONTEXT_SCHEMA_VERSION = 'garden_ai_context_v1' as const
export const GARDEN_AI_PROPOSAL_SCHEMA_VERSION = 'garden_ai_check_v1' as const

/** JSON Schema passed to a provider's structured-output mode at integration time. */
export const GARDEN_AI_CHECK_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'status', 'summary', 'evidence_used', 'overall_visible_state', 'development_recommendations', 'possible_harvest_readiness', 'possible_incident', 'observations', 'uncertainty', 'questions', 'suggested_next_actions', 'confidence'],
  properties: {
    schema_version: { const: GARDEN_AI_PROPOSAL_SCHEMA_VERSION },
    status: { enum: ['complete', 'insufficient_evidence'] },
    summary: { type: 'string' },
    evidence_used: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: { kind: { enum: ['photo', 'event', 'control'] }, id: { type: 'string' } } } },
    overall_visible_state: { anyOf: [{ enum: ['appears_stable', 'watch', 'possible_issue', 'insufficient_evidence'] }, { type: 'null' }] },
    development_recommendations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'recommendation', 'rationale', 'confidence'], properties: { kind: { enum: ['thinning', 'pruning', 'support'] }, recommendation: { enum: ['no_action', 'monitor', 'evaluate', 'action_recommended', 'insufficient_evidence'] }, rationale: { type: 'string' }, confidence: { enum: ['low', 'medium', 'high'] } } } },
    possible_harvest_readiness: { anyOf: [{ enum: ['not_assessed', 'possible_not_yet', 'possible_evaluate', 'possible_ready', 'possible_not_applicable', 'insufficient_evidence'] }, { type: 'null' }] },
    possible_incident: { anyOf: [{ enum: ['no_visible_signs', 'possible', 'insufficient_evidence'] }, { type: 'null' }] },
    observations: { type: 'array', items: { type: 'string' } },
    uncertainty: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    suggested_next_actions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'rationale'], properties: { kind: { enum: ['none', 'monitor', 'create_follow_up', 'record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'] }, rationale: { type: 'string' } } } },
    confidence: { enum: ['low', 'medium', 'high'] },
  },
}

export type GardenAiStatus = 'complete' | 'insufficient_evidence'
export type GardenAiConfidence = 'low' | 'medium' | 'high'
export type GardenAiRecommendation = 'no_action' | 'monitor' | 'evaluate' | 'action_recommended' | 'insufficient_evidence'
export type GardenAiEvidenceRef = { kind: 'photo' | 'event' | 'control'; id: string }
export type GardenAiActionKind = 'create_follow_up' | 'record_incident' | 'confirm_plant_count' | 'evaluate_harvest_readiness'

export interface GardenAiDevelopmentRecommendation {
  kind: 'thinning' | 'pruning' | 'support'
  recommendation: GardenAiRecommendation
  rationale: string
  confidence: GardenAiConfidence
}

export interface GardenAiCheckProposalV1 {
  schema_version: typeof GARDEN_AI_PROPOSAL_SCHEMA_VERSION
  status: GardenAiStatus
  summary: string
  evidence_used: GardenAiEvidenceRef[]
  overall_visible_state?: 'appears_stable' | 'watch' | 'possible_issue' | 'insufficient_evidence'
  development_recommendations: GardenAiDevelopmentRecommendation[]
  possible_harvest_readiness?: 'not_assessed' | 'possible_not_yet' | 'possible_evaluate' | 'possible_ready' | 'possible_not_applicable' | 'insufficient_evidence'
  possible_incident?: 'no_visible_signs' | 'possible' | 'insufficient_evidence'
  observations: string[]
  uncertainty: string[]
  questions: string[]
  suggested_next_actions: Array<{
    kind: 'none' | 'monitor' | GardenAiActionKind
    rationale: string
  }>
  confidence: GardenAiConfidence
}

export interface GardenAiActionContext {
  growCycleId: string
  gardenId: string
  positionId: string
  evidenceRef: GardenAiEvidenceRef
  suggestedValue?: number
}

export interface GardenAiCanonicalAction {
  kind: GardenAiActionKind
  label: string
  context: GardenAiActionContext
}

export interface AskGardenAnswerV1 {
  schema_version: 'garden_ai_ask_v1'
  answer_type: 'answer' | 'insufficient_evidence' | 'needs_clarification'
  answer: string
  confirmed_facts: Array<{ source: GardenAiEvidenceRef; claim: string }>
  interpretation?: string
  suggested_next_actions: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const recommendations = new Set<GardenAiRecommendation>(['no_action', 'monitor', 'evaluate', 'action_recommended', 'insufficient_evidence'])
const confidences = new Set<GardenAiConfidence>(['low', 'medium', 'high'])
const evidenceKinds = new Set<GardenAiEvidenceRef['kind']>(['photo', 'event', 'control'])

/**
 * Runtime boundary for provider output. Unknown optional fields are ignored;
 * malformed required fields are rejected before anything reaches the UI.
 */
export function validateGardenAiCheckProposal(value: unknown): GardenAiCheckProposalV1 | null {
  if (!isRecord(value) || value.schema_version !== GARDEN_AI_PROPOSAL_SCHEMA_VERSION) return null
  if (value.status !== 'complete' && value.status !== 'insufficient_evidence') return null
  if (!isNonEmptyString(value.summary) || !Array.isArray(value.evidence_used) || !Array.isArray(value.development_recommendations)) return null
  if (!Array.isArray(value.observations) || !value.observations.every(isNonEmptyString)) return null
  if (!Array.isArray(value.uncertainty) || !value.uncertainty.every(isNonEmptyString)) return null
  if (!Array.isArray(value.questions) || !value.questions.every(isNonEmptyString)) return null
  if (!confidences.has(value.confidence as GardenAiConfidence)) return null

  const evidence = value.evidence_used.map((item) => {
    if (!isRecord(item) || !evidenceKinds.has(item.kind as GardenAiEvidenceRef['kind']) || !isNonEmptyString(item.id)) return null
    return { kind: item.kind as GardenAiEvidenceRef['kind'], id: item.id }
  })
  if (evidence.some((item) => item === null)) return null

  const development = value.development_recommendations.map((item) => {
    if (!isRecord(item) || !['thinning', 'pruning', 'support'].includes(String(item.kind))) return null
    if (!recommendations.has(item.recommendation as GardenAiRecommendation) || !isNonEmptyString(item.rationale) || !confidences.has(item.confidence as GardenAiConfidence)) return null
    return {
      kind: item.kind as GardenAiDevelopmentRecommendation['kind'],
      recommendation: item.recommendation as GardenAiRecommendation,
      rationale: item.rationale,
      confidence: item.confidence as GardenAiConfidence,
    }
  })
  if (development.some((item) => item === null)) return null

  const allowedReadiness = new Set(['not_assessed', 'possible_not_yet', 'possible_evaluate', 'possible_ready', 'possible_not_applicable', 'insufficient_evidence'])
  if (value.possible_harvest_readiness !== undefined && !allowedReadiness.has(String(value.possible_harvest_readiness))) return null
  if (value.possible_incident !== undefined && !['no_visible_signs', 'possible', 'insufficient_evidence'].includes(String(value.possible_incident))) return null

  const allowedActionKinds = new Set(['none', 'monitor', 'create_follow_up', 'record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'])
  if (!Array.isArray(value.suggested_next_actions)) return null
  const actions = value.suggested_next_actions.map((item) => {
    if (!isRecord(item) || !allowedActionKinds.has(String(item.kind)) || !isNonEmptyString(item.rationale)) return null
    return { kind: item.kind as GardenAiCheckProposalV1['suggested_next_actions'][number]['kind'], rationale: item.rationale }
  })
  if (actions.some((item) => item === null)) return null

  return {
    schema_version: GARDEN_AI_PROPOSAL_SCHEMA_VERSION,
    status: value.status,
    summary: value.summary,
    evidence_used: evidence as GardenAiEvidenceRef[],
    overall_visible_state: value.overall_visible_state as GardenAiCheckProposalV1['overall_visible_state'],
    development_recommendations: development as GardenAiDevelopmentRecommendation[],
    possible_harvest_readiness: value.possible_harvest_readiness as GardenAiCheckProposalV1['possible_harvest_readiness'],
    possible_incident: value.possible_incident as GardenAiCheckProposalV1['possible_incident'],
    observations: value.observations,
    uncertainty: value.uncertainty,
    questions: value.questions,
    suggested_next_actions: actions as GardenAiCheckProposalV1['suggested_next_actions'],
    confidence: value.confidence as GardenAiConfidence,
  }
}

export function buildCanonicalActions(proposal: GardenAiCheckProposalV1, context: GardenAiActionContext): GardenAiCanonicalAction[] {
  const actions: GardenAiCanonicalAction[] = []
  for (const recommendation of proposal.development_recommendations) {
    if (recommendation.recommendation === 'evaluate' || recommendation.recommendation === 'action_recommended') {
      const purpose = recommendation.kind === 'thinning' ? 'Evaluar aclareo' : recommendation.kind === 'pruning' ? 'Evaluar poda' : 'Evaluar soporte'
      actions.push({ kind: 'create_follow_up', label: purpose, context })
    }
  }
  if (proposal.possible_incident === 'possible') actions.push({ kind: 'record_incident', label: 'Registrar incidencia', context })
  if (proposal.possible_harvest_readiness === 'possible_evaluate' || proposal.possible_harvest_readiness === 'possible_ready') {
    actions.push({ kind: 'evaluate_harvest_readiness', label: 'Evaluar preparación para cosecha', context })
  }
  return actions
}
