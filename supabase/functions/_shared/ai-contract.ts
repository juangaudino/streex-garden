export const GARDEN_AI_STANDARD_VERSION = 'garden_ai_standard_v1'
export const GARDEN_AI_CONTEXT_SCHEMA_VERSION = 'garden_ai_context_v1'
export const GARDEN_AI_PROPOSAL_SCHEMA_VERSION = 'garden_ai_check_v1'
export const GARDEN_AI_ASK_SCHEMA_VERSION = 'garden_ai_ask_v1'

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

export const GARDEN_AI_ASK_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'answer_type', 'answer', 'confirmed_facts', 'suggested_next_actions'],
  properties: {
    schema_version: { const: GARDEN_AI_ASK_SCHEMA_VERSION },
    answer_type: { enum: ['answer', 'insufficient_evidence', 'needs_clarification'] },
    answer: { type: 'string' },
    confirmed_facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['source', 'claim'], properties: { source: { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: { kind: { enum: ['photo', 'event', 'control'] }, id: { type: 'string' } } }, claim: { type: 'string' } } } },
    suggested_next_actions: { type: 'array', items: { type: 'string' } },
  },
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export function validateAiCheckProposal(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_AI_PROPOSAL_SCHEMA_VERSION || !['complete', 'insufficient_evidence'].includes(String(value.status)) || !nonEmpty(value.summary) || !Array.isArray(value.evidence_used) || !Array.isArray(value.development_recommendations) || !Array.isArray(value.observations) || !Array.isArray(value.uncertainty) || !Array.isArray(value.questions) || !Array.isArray(value.suggested_next_actions) || !['low', 'medium', 'high'].includes(String(value.confidence))) return null
  if (value.possible_incident !== null && value.possible_incident !== undefined && !['no_visible_signs', 'possible', 'insufficient_evidence'].includes(String(value.possible_incident))) return null
  if (value.evidence_used.some((item) => !record(item) || !['photo', 'event', 'control'].includes(String(item.kind)) || !nonEmpty(item.id))) return null
  if (value.development_recommendations.some((item) => !record(item) || !['thinning', 'pruning', 'support'].includes(String(item.kind)) || !['no_action', 'monitor', 'evaluate', 'action_recommended', 'insufficient_evidence'].includes(String(item.recommendation)) || !nonEmpty(item.rationale) || !['low', 'medium', 'high'].includes(String(item.confidence)))) return null
  if (value.suggested_next_actions.some((item) => !record(item) || !['none', 'monitor', 'create_follow_up', 'record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'].includes(String(item.kind)) || !nonEmpty(item.rationale))) return null
  return value
}

export function validateAskGardenAnswer(value: unknown): Record<string, unknown> | null {
  if (!record(value) || value.schema_version !== GARDEN_AI_ASK_SCHEMA_VERSION || !['answer', 'insufficient_evidence', 'needs_clarification'].includes(String(value.answer_type)) || !nonEmpty(value.answer) || !Array.isArray(value.confirmed_facts) || !Array.isArray(value.suggested_next_actions)) return null
  return value
}
