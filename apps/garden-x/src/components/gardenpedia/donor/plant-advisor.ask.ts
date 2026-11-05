export type GardenpediaAskCitation = { id: string; label: string; url: string };
export type GardenpediaAskEvidenceSupport = {
  id: string;
  plantName: string;
  section: string;
  evidenceType: "source_backed" | "garden_adaptation" | "needs_validation";
  confidence: string;
  sourceIds: string[];
};
export type GardenpediaAskHistoryItem = { question: string; answer: string };
export type GardenpediaAskAnswer = {
  answerType: "answer" | "insufficient_evidence" | "needs_clarification";
  answer: string;
  citations: GardenpediaAskCitation[];
  evidenceSupport: GardenpediaAskEvidenceSupport[];
  followUpQuestion: string | null;
  quota: {
    hour_remaining: number | null;
    day_remaining: number | null;
    site_remaining: number | null;
  } | null;
};

export class GardenpediaAskError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "GardenpediaAskError";
  }
}

export async function askGardenpediaQuestion(input: {
  question: string;
  language: "en" | "es";
  history: readonly GardenpediaAskHistoryItem[];
}): Promise<GardenpediaAskAnswer> {
  const response = await fetch("/api/gardenpedia/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      question: input.question,
      language: input.language,
      history: input.history.slice(-4),
    }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GardenpediaAskError("invalid_response");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GardenpediaAskError("invalid_response");
  }
  const result = payload as Record<string, unknown>;
  if (!response.ok) {
    throw new GardenpediaAskError(
      typeof result["error"] === "string" ? result["error"] : "ask_unavailable",
      Number(response.headers.get("Retry-After")) || null,
    );
  }
  if (
    !["answer", "insufficient_evidence", "needs_clarification"].includes(
      String(result["answerType"]),
    ) ||
    typeof result["answer"] !== "string" ||
    !Array.isArray(result["citations"]) ||
    !Array.isArray(result["evidenceSupport"])
  ) {
    throw new GardenpediaAskError("invalid_response");
  }
  const citations = result["citations"].filter((item): item is GardenpediaAskCitation => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate["id"] === "string" &&
      typeof candidate["label"] === "string" &&
      typeof candidate["url"] === "string" &&
      candidate["url"].startsWith("https://")
    );
  });
  const evidenceSupport = result["evidenceSupport"].filter(
    (item): item is GardenpediaAskEvidenceSupport => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate["id"] === "string" &&
        typeof candidate["plantName"] === "string" &&
        typeof candidate["section"] === "string" &&
        ["source_backed", "garden_adaptation", "needs_validation"].includes(
          String(candidate["evidenceType"]),
        ) &&
        typeof candidate["confidence"] === "string" &&
        Array.isArray(candidate["sourceIds"]) &&
        candidate["sourceIds"].every((id) => typeof id === "string")
      );
    },
  );
  const quotaRecord =
    result["quota"] && typeof result["quota"] === "object"
      ? (result["quota"] as Record<string, unknown>)
      : null;
  const quota = quotaRecord
    ? {
        hour_remaining:
          typeof quotaRecord["hour_remaining"] === "number" ? quotaRecord["hour_remaining"] : null,
        day_remaining:
          typeof quotaRecord["day_remaining"] === "number" ? quotaRecord["day_remaining"] : null,
        site_remaining:
          typeof quotaRecord["site_remaining"] === "number" ? quotaRecord["site_remaining"] : null,
      }
    : null;

  return {
    answerType: result["answerType"] as GardenpediaAskAnswer["answerType"],
    answer: result["answer"],
    citations,
    evidenceSupport,
    followUpQuestion:
      typeof result["followUpQuestion"] === "string" ? result["followUpQuestion"] : null,
    quota,
  };
}
