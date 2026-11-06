import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { OpenAiResponsesAdapter } from "../_shared/ai-provider.ts";
import {
  GARDEN_AI_STANDARD_VERSION,
  GARDENPEDIA_ASK_JSON_SCHEMA,
  GARDENPEDIA_ASK_SCHEMA_VERSION,
  validateGardenpediaAskAnswer,
} from "../_shared/ai-contract.ts";
import {
  gardenpediaAskInstructions,
  validatePublicAskEvidence,
  validatePublicAskHistory,
} from "../_shared/gardenpedia-ask.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey =
  Deno.env.get("GARDENPEDIA_ASK_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY");
const serviceCredentials = [
  Deno.env.get("GARDENPEDIA_ASK_SERVICE_ROLE_KEY"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  Deno.env.get("SUPABASE_SECRET_KEY"),
].filter((value): value is string => Boolean(value));
const enabled = Deno.env.get("GARDEN_AI_ENABLED") === "true";
const providerName = Deno.env.get("GARDEN_AI_PROVIDER") ?? "openai";
const model = "gpt-5.6-luna";

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

function validRequestKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (
    !serviceCredentials.some(
      (credential) => authorization === `Bearer ${credential}`,
    )
  ) {
    return json({ error: "unauthorized" }, 401);
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== "https://garden.getstreex.com") {
    return json({ error: "origin_not_allowed" }, 403);
  }
  if (
    !enabled ||
    providerName !== "openai" ||
    !Deno.env.get("OPENAI_API_KEY") ||
    !model
  ) {
    return json({ error: "ask_unavailable" }, 503);
  }
  if (!supabaseUrl || !serviceKey)
    return json({ error: "rate_limit_unavailable" }, 503);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 28_000) return json({ error: "request_too_large" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "invalid_request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (
    typeof body.question !== "string" ||
    body.question.trim().length < 2 ||
    body.question.length > 2000
  ) {
    return json({ error: "invalid_question" }, 400);
  }
  if (body.language !== "en" && body.language !== "es")
    return json({ error: "invalid_language" }, 400);
  if (!validRequestKey(body.ip_fingerprint))
    return json({ error: "invalid_visitor_fingerprint" }, 400);
  const evidence = validatePublicAskEvidence(body.evidence);
  if (!evidence) return json({ error: "invalid_public_evidence" }, 400);
  const history = validatePublicAskHistory(body.history);
  if (!history) return json({ error: "invalid_history" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const quotaResult = await admin.rpc("gardenpedia_consume_visitor_quota", {
    p_ip_fingerprint: body.ip_fingerprint,
  });
  if (
    quotaResult.error ||
    !quotaResult.data ||
    typeof quotaResult.data !== "object"
  ) {
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  const quota = quotaResult.data as Record<string, unknown>;
  if (quota.allowed !== true) {
    const retryAfter = Number.isInteger(quota.retry_after_seconds)
      ? Math.max(1, Number(quota.retry_after_seconds))
      : 3600;
    return json(
      { error: quota.reason ?? "visitor_limit_reached", quota },
      429,
      {
        "Retry-After": String(retryAfter),
      },
    );
  }

  if (evidence.length === 0) {
    return json({
      answerType: "insufficient_evidence",
      answer:
        body.language === "es"
          ? "No encontré evidencia aplicable en el conocimiento público de Gardenpedia para responder eso con seguridad. Puedes precisar la planta o el tema."
          : "I could not find applicable evidence in Gardenpedia's public knowledge to answer that safely. You can clarify the plant or topic.",
      citedEvidenceIds: [],
      followUpQuestion: null,
      quota,
    });
  }

  const provider = new OpenAiResponsesAdapter(
    Deno.env.get("OPENAI_API_KEY")!,
    model,
  );
  const language = body.language;
  try {
    const response = await provider.analyze({
      operation: "gardenpedia_ask",
      context: {
        question: body.question.trim(),
        conversation: history,
        public_gardenpedia_evidence: evidence,
        evidence_ids: evidence.map((item) => item.id),
      },
      standardVersion: GARDEN_AI_STANDARD_VERSION,
      promptVersion: GARDENPEDIA_ASK_SCHEMA_VERSION,
      jsonSchema: GARDENPEDIA_ASK_JSON_SCHEMA,
      instructions: gardenpediaAskInstructions(language),
    });
    const validIds = new Set(evidence.map((item) => item.id));
    const answer = validateGardenpediaAskAnswer(response.raw, validIds);
    if (!answer) return json({ error: "invalid_answer", quota }, 502);

    return json({
      answerType: answer.answer_type,
      answer: answer.answer,
      citedEvidenceIds: answer.cited_evidence_ids,
      followUpQuestion: answer.follow_up_question ?? null,
      quota,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const status = /AI provider HTTP 429/.test(detail) ? 429 : 503;
    return json(
      {
        error: status === 429 ? "provider_rate_limited" : "ask_unavailable",
        quota,
      },
      status,
      {
        ...(status === 429 ? { "Retry-After": "30" } : {}),
      },
    );
  }
});
