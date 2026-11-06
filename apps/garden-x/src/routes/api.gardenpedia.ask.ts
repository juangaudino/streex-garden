import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createFileRoute } from "@tanstack/react-router";

import { retrieveGardenpediaEvidence } from "@/components/gardenpedia/donor/plant-advisor.evidence";
import { validatePublicAskHistory } from "../../../../supabase/functions/_shared/gardenpedia-ask";

const canonicalOrigin = "https://garden.getstreex.com";
const canonicalSupabaseUrl = "https://fnhggqqnkhkrfwmnsqmy.supabase.co";

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  if (origin === canonicalOrigin) return true;
  const previewOrigin = process.env["VERCEL_URL"];
  if (previewOrigin && origin === `https://${previewOrigin}`) return true;
  if (process.env["NODE_ENV"] === "development") {
    try {
      const host = new URL(origin).hostname;
      return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
      return false;
    }
  }
  return false;
}

function safeEvidenceForModel(
  query: string,
  language: "en" | "es",
  history: Array<{ question: string; answer: string }>,
) {
  const retrievalQuery = history.length ? `${query} ${history.at(-1)!.question}` : query;
  return retrieveGardenpediaEvidence(retrievalQuery, language, 8).map((item) => ({
    id: item.id,
    plantId: item.plantId,
    plantName: item.plantName,
    scientificName: item.scientificName,
    section: item.section,
    text: item.text.slice(0, 2400),
    evidenceType: item.evidenceType,
    confidence: item.confidence,
    sources: item.sources.slice(0, 12),
  }));
}

export const Route = createFileRoute("/api/gardenpedia/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAllowedOrigin(request.headers.get("Origin"))) {
          return json({ error: "origin_not_allowed" }, 403);
        }

        const contentLength = Number(request.headers.get("Content-Length") ?? 0);
        if (contentLength > 24_000) return json({ error: "request_too_large" }, 413);

        let body: Record<string, unknown>;
        try {
          const raw = await request.text();
          if (raw.length > 24_000) return json({ error: "request_too_large" }, 413);
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return json({ error: "invalid_request" }, 400);
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return json({ error: "invalid_request" }, 400);
        }

        if (
          typeof body["question"] !== "string" ||
          body["question"].trim().length < 2 ||
          body["question"].length > 2000
        ) {
          return json({ error: "invalid_question" }, 400);
        }
        const language = body["language"] === "en" ? "en" : body["language"] === "es" ? "es" : null;
        if (!language) return json({ error: "invalid_language" }, 400);
        const history = validatePublicAskHistory(body["history"]);
        if (!history) return json({ error: "invalid_history" }, 400);

        const supabaseUrl = process.env["VITE_SUPABASE_URL"];
        const serviceRoleKey = process.env["GARDENPEDIA_ASK_SERVICE_ROLE_KEY"];
        if (supabaseUrl !== canonicalSupabaseUrl || !serviceRoleKey) {
          return json({ error: "ask_unavailable" }, 503);
        }

        const clientIp =
          request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
        const normalizedIp = clientIp?.split(",")[0]?.trim() ?? "";
        if (isIP(normalizedIp) === 0) return json({ error: "visitor_limit_unavailable" }, 503);
        const ipFingerprint = createHmac("sha256", serviceRoleKey)
          .update(normalizedIp)
          .digest("hex");

        const question = body["question"].trim();
        const evidence = safeEvidenceForModel(question, language, history);
        const functionUrl = `${supabaseUrl}/functions/v1/gardenpedia-ask`;
        let upstream: Response;
        try {
          upstream = await fetch(functionUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question,
              language,
              history,
              evidence,
              ip_fingerprint: ipFingerprint,
            }),
          });
        } catch {
          return json({ error: "ask_unavailable" }, 503);
        }

        let payload: Record<string, unknown>;
        try {
          const value: unknown = await upstream.json();
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return json({ error: "ask_unavailable" }, 503);
          }
          payload = value as Record<string, unknown>;
        } catch {
          return json({ error: "ask_unavailable" }, 503);
        }

        if (!upstream.ok) {
          return json(payload, upstream.status, {
            ...(upstream.headers.get("Retry-After")
              ? { "Retry-After": upstream.headers.get("Retry-After")! }
              : {}),
          });
        }

        if (typeof payload["answer"] !== "string" || !Array.isArray(payload["citedEvidenceIds"])) {
          return json({ error: "invalid_answer" }, 502);
        }
        const citedIds = new Set(
          payload["citedEvidenceIds"].filter((id): id is string => typeof id === "string"),
        );
        const citedEvidence = evidence.filter((item) => citedIds.has(item.id));
        const citations = [
          ...new Map(
            citedEvidence.flatMap((item) => item.sources).map((source) => [source.id, source]),
          ).values(),
        ];
        const evidenceSupport = citedEvidence.map((item) => ({
          id: item.id,
          plantName: item.plantName,
          section: item.section,
          evidenceType: item.evidenceType,
          confidence: item.confidence,
          sourceIds: item.sources.map((source) => source.id),
        }));

        return json({
          answerType: payload["answerType"],
          answer: payload["answer"],
          citations,
          evidenceSupport,
          followUpQuestion: payload["followUpQuestion"] ?? null,
          quota: payload["quota"] ?? null,
        });
      },
    },
  },
});
