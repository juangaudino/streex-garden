import { describe, expect, it } from "vitest";
import { plantsAtPosition, projectPlantRelocation, resolvePositionByIdOrLabel } from "./garden-logic";
import type { Plant } from "./garden-data";

const plant = (id: string, positionId: string): Plant => ({
  id,
  name: id,
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "",
  knowledgeId: "basil",
  plantedDaysAgo: 10,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  gardenId: "garden",
  slot: "Pod 1",
  backendPositionId: positionId,
});

describe("shared position derivation", () => {
  it("counts active plants at one physical position and excludes the moving plant", () => {
    const plants = [plant("a", "position-9"), plant("b", "position-9"), plant("c", "position-4")];
    expect(plantsAtPosition(plants, "position-9")).toHaveLength(2);
    expect(plantsAtPosition(plants, "position-9", "a").map((item) => item.id)).toEqual(["b"]);
  });

  it("clears the derived conflict once the second plant leaves", () => {
    const plants = [plant("a", "position-9"), plant("b", "position-4")];
    expect(plantsAtPosition(plants, "position-9")).toHaveLength(1);
  });
});

describe("relocation destination resolution", () => {
  const positions = [
    { id: "h1-p4", number: 4 },
    { id: "h1-p6", number: 6 },
  ];

  it("uses the canonical position id when changing gardens", () => {
    expect(resolvePositionByIdOrLabel(positions, "h1-p4", "Pod 6")?.id).toBe("h1-p4");
  });

  it("falls back to the last number in a display label", () => {
    expect(resolvePositionByIdOrLabel(positions, null, "H1 · Pod 4")?.id).toBe("h1-p4");
  });
});

describe("confirmed relocation projection", () => {
  it("updates the local plant location after canonical persistence", () => {
    const plants = [plant("iceberg", "h3-p6"), plant("other", "h1-p4")];
    const next = projectPlantRelocation(plants, "iceberg", "garden-1", "h1-p4", 4);
    expect(next.find((item) => item.id === "iceberg")).toMatchObject({
      gardenId: "garden-1",
      backendPositionId: "h1-p4",
      slot: "Pod 4",
    });
    expect(next.find((item) => item.id === "other")?.backendPositionId).toBe("h1-p4");
  });
});
