import { describe, expect, it } from "vitest";

import { buildSeedLibraryCards } from "./seed-library-adapter";

describe("lightweight public Seed library adapter", () => {
  it("renders all published cards without loading profile bodies", () => {
    const cards = buildSeedLibraryCards("en");

    expect(cards).toHaveLength(211);
    expect(cards.find((card) => card.id === "genovese-basil")).toMatchObject({
      name: "Genovese Basil",
      quickFactCount: expect.any(Number),
      sourceCount: expect.any(Number),
    });
  });

  it("localizes card summaries from generated metadata", () => {
    const english = buildSeedLibraryCards("en").find((card) => card.id === "genovese-basil");
    const spanish = buildSeedLibraryCards("es").find((card) => card.id === "genovese-basil");

    expect(english?.summary).toBeTruthy();
    expect(spanish?.summary).toBeTruthy();
    expect(spanish?.summary).not.toBe(english?.summary);
  });
});
