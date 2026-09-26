// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { AddPlantSheet } from "./add-plant";
import { gardenLibraryManifest } from "../../generated/garden-library-manifest";
import { loadGardenLibraryCatalog } from "@/lib/garden-library";
import type { Garden, Plant } from "@/lib/garden-data";
import type { GardenLibraryManifest } from "@/lib/garden-library";

const mocks = vi.hoisted(() => ({
  createLibraryPlant: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/garden-store", () => ({
  useGarden: () => ({
    language: "en",
    gardens: [gardenFixture()],
    plants: plantFixtures,
    createLibraryPlant: mocks.createLibraryPlant,
  }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));

function gardenFixture(): Garden {
  return {
    id: "garden-test",
    name: "Test Garden",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    cover: "",
    place: "",
    note: "",
    machine: { name: "Aera One", pods: 3 },
    systemDefinitionKey: "aera-one-v1",
    backendPositions: [
      {
        id: "empty-position",
        number: 1,
        active: true,
        levelNumber: 1,
        rowNumber: 1,
        columnNumber: 1,
      },
      {
        id: "shared-neighbor",
        number: 2,
        active: true,
        levelNumber: 1,
        rowNumber: 1,
        columnNumber: 2,
      },
    ],
    systemLayoutLevels: [{ levelNumber: 1, rows: 1, columns: 2 }],
  };
}

const plantFixtures: Plant[] = [
  {
    id: "neighbor-one",
    gardenId: "garden-test",
    backendPositionId: "shared-neighbor",
    backendGrowCycleId: "cycle-one",
    name: "Neighbor 1",
    species: "",
    scientific: "",
    variety: "",
    knowledgeId: "common-mint",
    libraryPlantId: "common-mint",
    plantedDaysAgo: 0,
    status: "steady",
    statusNote: "",
    heroPhotoId: "",
    identityConfirmed: true,
  },
  {
    id: "neighbor-two",
    gardenId: "garden-test",
    backendPositionId: "shared-neighbor",
    backendGrowCycleId: "cycle-two",
    name: "Neighbor 2",
    species: "",
    scientific: "",
    variety: "",
    knowledgeId: "common-mint",
    libraryPlantId: "common-mint",
    plantedDaysAgo: 0,
    status: "steady",
    statusNote: "",
    heroPhotoId: "",
    identityConfirmed: true,
  },
];

function openSheet() {
  return render(
    <AddPlantSheet
      gardenId="garden-test"
      positionId="empty-position"
      slot="H1 · Pod 1"
      open
      onClose={vi.fn()}
    />,
  );
}

describe("AddPlantSheet contextual B3 entry point", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createLibraryPlant.mockResolvedValue("plant-created");
    mocks.navigate.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(gardenLibraryManifest), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("runs the deterministic engine for the selected empty position and preserves shared occupants", async () => {
    const evaluateSpy = vi.spyOn(
      await import("@/lib/garden-compatibility-engine"),
      "evaluateEmptyGardenPosition",
    );
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));

    expect(await screen.findByRole("heading", { name: "Evidence for this position" })).toBeTruthy();
    await waitFor(() => expect(evaluateSpy).toHaveBeenCalled());
    const input = evaluateSpy.mock.calls[0]![0];
    expect(input.target.positionId).toBe("empty-position");
    expect(
      input.positions.find((position) => position.id === "shared-neighbor")?.occupants,
    ).toHaveLength(2);
  });

  it("shows compatible, conditional, and unknown groups without presenting the full catalog as evidence", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));

    expect(await screen.findByRole("region", { name: "Evidence supports this" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Needs a condition" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "More evidence needed" })).toBeTruthy();
    expect(screen.getByText("Cascading Petunia")).toBeTruthy();
    expect(screen.getByText("Conditional evidence")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search basil, Ocimum, Genovese…")).toBeNull();
    expect(screen.getByText("Bibb Lettuce")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b(best|winner|recommended|score)\b/i);
  });

  it("keeps system fit and physical fit visibly independent", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));

    const buttercrunch = await screen.findByText("Buttercrunch Lettuce");
    const card = buttercrunch.closest("article");
    expect(card?.textContent).toContain("Fit for this specific system is not documented.");
    expect(card?.textContent).toContain("Physical fit for this position is not confirmed.");
    expect(card?.textContent).toContain("Cultivation evidence supports");
  });

  it("keeps Tiny Tim identity facts separate from Cherry Tomato in the candidate cards", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));
    const tinyTim = (await screen.findByText("Tiny Tim Tomato")).closest("article")!;
    const cherry = screen.getByText("Cherry Tomato").closest("article")!;
    expect(tinyTim.textContent).toContain("Documented growth habit: bushy.");
    expect(cherry.textContent).not.toContain("Documented growth habit");
    expect(tinyTim.querySelector("details")?.textContent).toContain("Identity-specific");
  });

  it("omits the growth-habit row and its spacing when the habit has no content", async () => {
    const manifest = structuredClone(gardenLibraryManifest) as GardenLibraryManifest;
    const mint = manifest.entries.find((entry) => entry.libraryPlantId === "common-mint");
    if (!mint?.compatibilityProfile || mint.compatibilityProfile.growthHabits.status !== "known") {
      throw new Error("Common Mint growth-habit evidence fixture is unavailable");
    }
    mint.compatibilityProfile.growthHabits = {
      ...mint.compatibilityProfile.growthHabits,
      value: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await loadGardenLibraryCatalog(true);

    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));

    const mintCard = (await screen.findByText("Common Mint")).closest("article");
    expect(mintCard?.textContent).not.toContain("Documented growth habit");
    expect(mintCard?.querySelector("ul.mt-2.space-y-1")).toBeNull();
  });

  it("preserves evidence source links and taxonomic scope", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));
    const buttercrunch = await screen.findByText("Buttercrunch Lettuce");
    const card = buttercrunch.closest("article")!;
    fireEvent.click(card.querySelector("summary")!);
    expect(card.querySelector("a[href^='http']")).toBeTruthy();
    expect(card.textContent).toContain("Species-level: Lactuca sativa");
  });

  it("returns to the searchable full Library and continues selection through the existing add flow", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));
    fireEvent.click(await screen.findByRole("button", { name: "Back to Library" }));
    expect(await screen.findByPlaceholderText("Search basil, Ocimum, Genovese…")).toBeTruthy();
    expect(screen.getByText("Bibb Lettuce")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Buttercrunch Lettuce/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to this position" }));
    await waitFor(() =>
      expect(mocks.createLibraryPlant).toHaveBeenCalledWith(
        expect.objectContaining({
          gardenId: "garden-test",
          positionId: "empty-position",
          libraryPlantId: "buttercrunch-lettuce",
        }),
      ),
    );
  });

  it("selects a contextual candidate using the existing Add Plant save flow", async () => {
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));
    fireEvent.click(await screen.findByRole("button", { name: /Buttercrunch Lettuce/ }));
    expect(
      await screen.findByText("Buttercrunch Lettuce", { selector: "p.font-display" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to this position" }));
    await waitFor(() =>
      expect(mocks.createLibraryPlant).toHaveBeenCalledWith(
        expect.objectContaining({
          gardenId: "garden-test",
          positionId: "empty-position",
          libraryPlantId: "buttercrunch-lettuce",
        }),
      ),
    );
  });

  it("shows a useful empty result while leaving the Library accessible", async () => {
    const engine = await import("@/lib/garden-compatibility-engine");
    vi.spyOn(engine, "evaluateEmptyGardenPosition").mockReturnValue([]);
    openSheet();
    fireEvent.click(await screen.findByRole("button", { name: "What could I plant here?" }));
    expect(await screen.findByText(/No candidates can be shown from the current compatibility evidence/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Library" }));
    expect(await screen.findByPlaceholderText("Search basil, Ocimum, Genovese…")).toBeTruthy();
  });
});
