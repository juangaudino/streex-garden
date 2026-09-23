export const GARDEN_AI_STANDARD_VERSION = 'garden_ai_standard_v1'
export const GARDEN_AI_CONTEXT_SCHEMA_VERSION = 'garden_ai_context_v1'
export const GARDEN_AI_PROPOSAL_SCHEMA_VERSION = 'garden_ai_check_v2'
export const GARDEN_AI_ASK_SCHEMA_VERSION = 'garden_ai_ask_v1'
export const GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION = 'garden_meaningful_change_v1'
export const GARDEN_SUMMARY_SCHEMA_VERSION = 'garden_summary_v1'
export const GARDEN_SHARE_CAPTION_SCHEMA_VERSION = 'garden_share_caption_v1'

export const GARDEN_SHARE_CAPTION_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'caption'],
  properties: {
    schema_version: { type: 'string', enum: [GARDEN_SHARE_CAPTION_SCHEMA_VERSION] },
    caption: { anyOf: [{ type: 'string', maxLength: 240 }, { type: 'null' }] },
  },
}

export const GARDEN_SUMMARY_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'summary_text', 'scope_type', 'scope_id', 'material_fingerprint', 'evidence_coverage', 'referenced_plant_instance_ids', 'referenced_meaningful_change_ids', 'referenced_ai_check_ids', 'epistemic_notes'],
  properties: {
    schema_version: { type: 'string', enum: [GARDEN_SUMMARY_SCHEMA_VERSION] },
    summary_text: { type: 'string' },
    scope_type: { enum: ['global', 'garden'] },
    scope_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    material_fingerprint: { type: 'string' },
    evidence_coverage: { type: 'object', additionalProperties: false, required: ['plant_count', 'garden_count', 'open_attention_count', 'recent_event_count', 'meaningful_change_count', 'ai_check_count'], properties: {
      plant_count: { type: 'integer', minimum: 0 }, garden_count: { type: 'integer', minimum: 0 }, open_attention_count: { type: 'integer', minimum: 0 }, recent_event_count: { type: 'integer', minimum: 0 }, meaningful_change_count: { type: 'integer', minimum: 0 }, ai_check_count: { type: 'integer', minimum: 0 },
    } },
    referenced_plant_instance_ids: { type: 'array', items: { type: 'string' } },
    referenced_meaningful_change_ids: { type: 'array', items: { type: 'string' } },
    referenced_ai_check_ids: { type: 'array', items: { type: 'string' } },
    epistemic_notes: { type: 'array', items: { type: 'string' } },
  },
}

export const GARDEN_MEANINGFUL_CHANGE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'comparison_status', 'primary_visual_observation', 'supporting_visual_observations', 'comparability_notes', 'interpretation', 'interpretation_confidence', 'relevant_context_facts', 'before_photo_id', 'after_photo_id', 'grow_cycle_id', 'plant_instance_id'],
  properties: {
    schema_version: { type: 'string', enum: [GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION] },
    comparison_status: { enum: ['meaningful_change', 'no_meaningful_change', 'limited_comparability'] },
    primary_visual_observation: { type: 'string' },
    supporting_visual_observations: { type: 'array', items: { type: 'string' } },
    comparability_notes: { type: 'array', items: { type: 'string' } },
    interpretation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    interpretation_confidence: { anyOf: [{ enum: ['low', 'medium', 'high'] }, { type: 'null' }] },
    relevant_context_facts: { type: 'array', items: { type: 'string' } },
    before_photo_id: { type: 'string' },
    after_photo_id: { type: 'string' },
    grow_cycle_id: { type: 'string' },
    plant_instance_id: { type: 'string' },
  },
}

export const GARDEN_AI_CHECK_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'status', 'headline', 'summary', 'evidence_used', 'overall_visible_state', 'development_recommendations', 'possible_harvest_readiness', 'possible_incident', 'observations', 'interpretations', 'uncertainty', 'questions', 'suggested_next_actions', 'confidence'],
  properties: {
    schema_version: { type: 'string', enum: [GARDEN_AI_PROPOSAL_SCHEMA_VERSION] },
    status: { enum: ['complete', 'insufficient_evidence'] },
    headline: { type: 'string' },
    summary: { type: 'string' },
    evidence_used: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: { kind: { enum: ['photo', 'event', 'control'] }, id: { type: 'string' } } } },
    overall_visible_state: { anyOf: [{ enum: ['appears_stable', 'watch', 'possible_issue', 'insufficient_evidence'] }, { type: 'null' }] },
    development_recommendations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'recommendation', 'rationale', 'confidence'], properties: { kind: { enum: ['thinning', 'pruning', 'support'] }, recommendation: { enum: ['no_action', 'monitor', 'evaluate', 'action_recommended', 'insufficient_evidence'] }, rationale: { type: 'string' }, confidence: { enum: ['low', 'medium', 'high'] } } } },
    possible_harvest_readiness: { anyOf: [{ enum: ['not_assessed', 'possible_not_yet', 'possible_evaluate', 'possible_ready', 'possible_not_applicable', 'insufficient_evidence'] }, { type: 'null' }] },
    possible_incident: { anyOf: [{ enum: ['no_visible_signs', 'possible', 'insufficient_evidence'] }, { type: 'null' }] },
    observations: { type: 'array', items: { type: 'string' } },
    interpretations: { type: 'array', items: { type: 'string' } },
    uncertainty: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    suggested_next_actions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'rationale'], properties: { kind: { enum: ['none', 'monitor', 'create_follow_up', 'record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'] }, rationale: { type: 'string' } } } },
    confidence: { enum: ['low', 'medium', 'high'] },
  },
}

export const GARDEN_AI_ASK_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'answer_type', 'answer', 'confirmed_facts', 'suggested_next_actions'],
  properties: {
    schema_version: { type: 'string', enum: [GARDEN_AI_ASK_SCHEMA_VERSION] },
    answer_type: { enum: ['answer', 'insufficient_evidence', 'needs_clarification'] },
    answer: { type: 'string' },
    confirmed_facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['source', 'claim'], properties: { source: { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: { kind: { enum: ['photo', 'event', 'control'] }, id: { type: 'string' } } }, claim: { type: 'string' } } } },
    suggested_next_actions: { type: 'array', items: { type: 'string' } },
  },
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const internalUserCopy = /(?:\bnot_yet\b|\bpossible_(?:not_yet|evaluate|ready|not_applicable)\b|\binsufficient_evidence\b|\b(?:plant_instance_id|grow_cycle_id|storage_path|context_schema_version)\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b)/i
const validUserText = (value: unknown, maxLength = 1200): value is string => nonEmpty(value) && value.length <= maxLength && !internalUserCopy.test(value)
const validHeadline = (value: unknown): value is string => {
  if (!validUserText(value, 120) || value.includes('\n')) return false
  return value.trim().split(/\s+/).length <= 16
}
const validTextArray = (value: unknown, maxLength = 1200): value is string[] => Array.isArray(value) && value.every((item) => validUserText(item, maxLength))

const physicalMeasurement = /\b\d+(?:\.\d+)?\s*(?:cm|mm|in(?:ches)?|%|percent)\b/i

export function validateMeaningfulChangeProposal(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION || !['meaningful_change', 'no_meaningful_change', 'limited_comparability'].includes(String(value.comparison_status)) || !validUserText(value.primary_visual_observation) || !validTextArray(value.supporting_visual_observations) || !validTextArray(value.comparability_notes) || !validTextArray(value.relevant_context_facts) || (value.interpretation !== null && value.interpretation !== undefined && !validUserText(value.interpretation)) || (value.interpretation_confidence !== null && value.interpretation_confidence !== undefined && !['low', 'medium', 'high'].includes(String(value.interpretation_confidence))) || !nonEmpty(value.before_photo_id) || !nonEmpty(value.after_photo_id) || value.before_photo_id === value.after_photo_id || !nonEmpty(value.grow_cycle_id) || !nonEmpty(value.plant_instance_id)) return null
  const prose = [value.primary_visual_observation, ...(value.supporting_visual_observations as unknown[]), ...(value.comparability_notes as unknown[]), ...(value.relevant_context_facts as unknown[]), value.interpretation]
  if (prose.some((item) => typeof item === 'string' && physicalMeasurement.test(item))) return null
  return value
}

export function validateAiCheckProposal(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_AI_PROPOSAL_SCHEMA_VERSION || !['complete', 'insufficient_evidence'].includes(String(value.status)) || !validHeadline(value.headline) || !validUserText(value.summary) || !Array.isArray(value.evidence_used) || !Array.isArray(value.development_recommendations) || !validTextArray(value.observations) || !validTextArray(value.interpretations) || !validTextArray(value.uncertainty) || !validTextArray(value.questions) || !Array.isArray(value.suggested_next_actions) || !['low', 'medium', 'high'].includes(String(value.confidence))) return null
  if (value.possible_incident !== null && value.possible_incident !== undefined && !['no_visible_signs', 'possible', 'insufficient_evidence'].includes(String(value.possible_incident))) return null
  if (value.evidence_used.some((item) => !record(item) || !['photo', 'event', 'control'].includes(String(item.kind)) || !nonEmpty(item.id))) return null
  if (value.development_recommendations.some((item) => !record(item) || !['thinning', 'pruning', 'support'].includes(String(item.kind)) || !['no_action', 'monitor', 'evaluate', 'action_recommended', 'insufficient_evidence'].includes(String(item.recommendation)) || !validUserText(item.rationale) || !['low', 'medium', 'high'].includes(String(item.confidence)))) return null
  if (value.suggested_next_actions.some((item) => !record(item) || !['none', 'monitor', 'create_follow_up', 'record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'].includes(String(item.kind)) || !validUserText(item.rationale))) return null
  return value
}

export function validateAskGardenAnswer(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_AI_ASK_SCHEMA_VERSION || !['answer', 'insufficient_evidence', 'needs_clarification'].includes(String(value.answer_type)) || !nonEmpty(value.answer) || !Array.isArray(value.confirmed_facts) || !Array.isArray(value.suggested_next_actions)) return null
  return value
}

export function validateCareReviewAttachment(photo: unknown, context: unknown): boolean {
  if (photo === undefined && context === undefined) return true
  if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(photo) || photo.length > 7_000_000) return false
  return typeof context === 'string' && context.trim().length > 0 && context.length <= 9_000
}

export function validateGardenSummaryProposal(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_SUMMARY_SCHEMA_VERSION || !validUserText(value.summary_text, 700) || !['global', 'garden'].includes(String(value.scope_type)) || (value.scope_id !== null && value.scope_id !== undefined && !nonEmpty(value.scope_id)) || !nonEmpty(value.material_fingerprint) || !record(value.evidence_coverage) || !Array.isArray(value.referenced_plant_instance_ids) || !Array.isArray(value.referenced_meaningful_change_ids) || !Array.isArray(value.referenced_ai_check_ids) || !validTextArray(value.epistemic_notes, 300)) return null
  if (value.scope_type === 'global' && value.scope_id !== null) return null
  if (value.scope_type === 'garden' && !nonEmpty(value.scope_id)) return null
  if (typeof value.material_fingerprint !== 'string' || !/^[a-f0-9]{32}$/i.test(value.material_fingerprint)) return null
  if (value.summary_text.split(/\n+/).length > 4) return null
  const coverage = value.evidence_coverage as Record<string, unknown>
  const coverageKeys = ['plant_count', 'garden_count', 'open_attention_count', 'recent_event_count', 'meaningful_change_count', 'ai_check_count']
  if (coverageKeys.some((key) => !Number.isInteger(coverage[key]) || Number(coverage[key]) < 0)) return null
  const referencedPlantIds = value.referenced_plant_instance_ids as unknown[]
  const referencedChangeIds = value.referenced_meaningful_change_ids as unknown[]
  const referencedCheckIds = value.referenced_ai_check_ids as unknown[]
  if ([...referencedPlantIds, ...referencedChangeIds, ...referencedCheckIds].some((item) => typeof item !== 'string' || item.length < 1 || item.length > 120)) return null
  return value
}

export function validateShareCaptionProposal(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_SHARE_CAPTION_SCHEMA_VERSION) return null
  if (value.caption !== null && value.caption !== undefined && !validUserText(value.caption, 240)) return null
  return value
}
