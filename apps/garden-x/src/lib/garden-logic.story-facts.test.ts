import { describe, expect, it } from "vitest";
import { storyFacts } from "./garden-logic";
import type { Plant, PlantEvent } from "./garden-data";

const plant: Plant = {
  id: "real-plant",
  gardenId: "garden-1",
  name: "Basil",
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "",
  knowledgeId: "basil",
  plantedDaysAgo: 20,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
};
const event = (id: string, type: PlantEvent["type"], title: string): PlantEvent => ({
  id,
  plantId: plant.id,
  daysAgo: 2,
  occurredAt: "2026-09-20T12:00:00.000Z",
  type,
  title,
  provenance: "recorded",
});

describe("contextual plant quick facts", () => {
  it("does not prioritize watering for hydroponic plants", () => {
    const facts = storyFacts(
      plant,
      [event("w", "maintenance", "Watering"), event("h", "harvest", "Harvest")],
      "en",
      "hydroponic",
    );
    expect(facts.map((fact) => fact.label)).not.toContain("Last watering");
  });

  it("keeps a combined maintenance action in one fact", () => {
    const facts = storyFacts(
      plant,
      [event("m", "maintenance", "Water + Nutrients"), event("h", "harvest", "Harvest")],
      "en",
      "hydroponic",
    );
    expect(facts.filter((fact) => /water|nutrient/i.test(fact.label))).toHaveLength(1);
  });
});
