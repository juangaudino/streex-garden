import { describe, expect, it } from "vitest";
import {
  GARDENPEDIA_ASK_SCHEMA_VERSION,
  validateGardenpediaAskAnswer,
} from "./ai-contract";
import {
  validatePublicAskEvidence,
  validatePublicAskHistory,
} from "./gardenpedia-ask";

const evidence = [
  {
    id: "basil:seed:germination:1",
    plantId: "plant-basil",
    plantName: "Genovese Basil",
    scientificName: "Ocimum basilicum",
    section: "Germination",
    text: "The public seed profile documents germination timing.",
    evidenceType: "source_backed",
    confidence: "high",
    sources: [
      {
        id: "source-1",
        label: "Extension · Basil",
        url: "https://example.org/basil",
      },
    ],
  },
];

describe("public Gardenpedia Ask contract", () => {
  it("accepts grounded answers citing only retrieved evidence IDs", () => {
    const result = validateGardenpediaAskAnswer(
      {
        schema_version: GARDENPEDIA_ASK_SCHEMA_VERSION,
        answer_type: "answer",
        answer: "The seed profile documents a germination window.",
        cited_evidence_ids: [evidence[0]!.id],
        follow_up_question: null,
      },
      new Set([evidence[0]!.id]),
    );

    expect(result).not.toBeNull();
  });

  it("rejects an answer with invented or missing citations", () => {
    const base = {
      schema_version: GARDENPEDIA_ASK_SCHEMA_VERSION,
      answer_type: "answer",
      answer: "This is a claim.",
      follow_up_question: null,
    };
    expect(
      validateGardenpediaAskAnswer(
        { ...base, cited_evidence_ids: ["invented"] },
        new Set([evidence[0]!.id]),
      ),
    ).toBeNull();
    expect(
      validateGardenpediaAskAnswer(
        { ...base, cited_evidence_ids: [] },
        new Set(),
      ),
    ).toBeNull();
  });

  it("retains pending evidence as evidence metadata instead of silently promoting it", () => {
    const result = validatePublicAskEvidence([
      { ...evidence[0], evidenceType: "needs_validation", sources: [] },
    ]);
    expect(result?.[0]?.evidenceType).toBe("needs_validation");
  });

  it("accepts an empty retrieval result so the visitor quota can still be consumed before abstaining", () => {
    expect(validatePublicAskEvidence([])).toEqual([]);
  });

  it("rejects unsafe source links and oversized or duplicate context", () => {
    expect(
      validatePublicAskEvidence([
        {
          ...evidence[0],
          sources: [{ id: "x", label: "bad", url: "javascript:alert(1)" }],
        },
      ]),
    ).toBeNull();
    expect(validatePublicAskEvidence([evidence[0], evidence[0]])).toBeNull();
    expect(
      validatePublicAskEvidence(
        Array.from({ length: 13 }, (_, index) => ({
          ...evidence[0],
          id: `id-${index}`,
        })),
      ),
    ).toBeNull();
  });

  it("bounds conversation history and keeps it separate from source evidence", () => {
    expect(
      validatePublicAskHistory([
        { question: "How much light?", answer: "The profile says…" },
      ]),
    ).toEqual([{ question: "How much light?", answer: "The profile says…" }]);
    expect(
      validatePublicAskHistory(
        Array.from({ length: 5 }, () => ({ question: "q", answer: "a" })),
      ),
    ).toBeNull();
  });
});
