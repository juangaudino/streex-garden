import { describe, expect, it } from "vitest";
import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import type { Garden, Plant, PlantEvent } from "./garden-data";
import { buildGardenExportWorkbook, safeWorksheetNames } from "./garden-export";

function garden(overrides: Partial<Garden> = {}): Garden {
  return {
    id: "garden-1",
    name: "Main/Garden",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    cover: "",
    place: "",
    note: "",
    machine: { name: "Kratky Unit", pods: 4 },
    backendPositions: [
      { id: "position-1", number: 1, label: "H1P1", active: true, rowNumber: 1, columnNumber: 1 },
      { id: "position-2", number: 2, label: "H1P2", active: true, rowNumber: 1, columnNumber: 2 },
      { id: "position-3", number: 3, label: "H1P3", active: false, rowNumber: 2, columnNumber: 1 },
      { id: "position-4", number: 4, active: true, rowNumber: 2, columnNumber: 2 },
    ],
    ...overrides,
  };
}

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: "plant-1",
    gardenId: "garden-1",
    name: "Basil",
    species: "Basil",
    scientific: "Ocimum basilicum",
    variety: "Genovese",
    knowledgeId: "genovese-basil",
    libraryPlantId: "genovese-basil",
    plantedOn: "2026-09-20",
    plantedDatePrecision: "exact",
    plantedDaysAgo: 10,
    status: "steady",
    statusNote: "",
    heroPhotoId: "",
    identityConfirmed: true,
    backendPositionId: "position-1",
    ...overrides,
  };
}

function event(overrides: Partial<PlantEvent> = {}): PlantEvent {
  return {
    id: "event-1",
    plantId: "plant-1",
    daysAgo: 8,
    occurredAt: "2026-09-22T12:00:00.000Z",
    type: "germinated",
    title: "Germinated",
    provenance: "recorded",
    lifeEvent: "germinated",
    ...overrides,
  };
}

async function storedZipEntries(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const dataLength = view.getUint32(offset + 18, true);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    entries.set(name, decoder.decode(bytes.slice(dataStart, dataStart + dataLength)));
    offset = dataStart + dataLength;
  }
  return entries;
}

describe("Garden export workbook", () => {
  it("creates one safe, unique sheet name per Garden", () => {
    expect(
      safeWorksheetNames([garden(), garden({ id: "garden-2", name: "Main/Garden" })]).map(
        (item) => item.name,
      ),
    ).toEqual(["Main Garden", "Main Garden (2)"]);
  });

  it("serializes all active positions, localized identities, dates, and the latest meaningful milestone", async () => {
    const output = buildGardenExportWorkbook({
      gardens: [garden()],
      plants: [
        plant(),
        plant({ id: "closed-plant", backendPositionId: "position-2", cycleClosed: true }),
        plant({
          id: "other-owner",
          gardenId: "other-garden",
          name: "Other owner's plant",
          backendPositionId: "position-4",
        }),
      ],
      events: [
        event({
          id: "planted",
          type: "planted",
          lifeEvent: "planted",
          occurredAt: "2026-09-20T12:00:00.000Z",
          daysAgo: 10,
        }),
        event({
          id: "germinated",
          type: "germinated",
          lifeEvent: "germinated",
          occurredAt: "2026-09-22T12:00:00.000Z",
          daysAgo: 8,
        }),
        event({
          id: "latest-note",
          type: "note",
          lifeEvent: undefined,
          occurredAt: "2026-09-29T12:00:00.000Z",
          daysAgo: 1,
        }),
        event({
          id: "ai",
          type: "ai",
          lifeEvent: undefined,
          occurredAt: "2026-09-30T12:00:00.000Z",
          daysAgo: 0,
        }),
      ],
      catalog: gardenLibraryManifest,
      language: "en",
      exportDate: new Date(2026, 8, 30, 12),
    });
    const entries = await storedZipEntries(output.blob);
    const sheet = entries.get("xl/worksheets/sheet1.xml") ?? "";

    expect(output.filename).toBe("garden-export-2026-09-30.xlsx");
    expect(output.sheetNames).toEqual(["Main Garden"]);
    expect(entries.has("[Content_Types].xml")).toBe(true);
    expect(entries.has("xl/workbook.xml")).toBe(true);
    expect(sheet).toContain("Kratky Unit");
    expect(sheet).toContain("4 / 3 active");
    expect(sheet).toContain("Hydroponic");
    expect(sheet).toContain("H1P1");
    expect(sheet).toContain("Pod 4");
    expect(sheet).toContain("Albahaca genovesa");
    expect(sheet).toContain("Germinated · Sep 22, 2026");
    expect(sheet).toContain('r="D8" s="4" t="n"');
    expect(sheet).toContain('r="E8" s="6" t="n"><v>10</v>');
    expect(sheet).not.toContain("H1P3");
    expect(sheet).not.toContain("closed-plant");
    expect(sheet).not.toContain("Other owner's plant");
  });

  it("keeps missing canonical dates and empty positions explicit", async () => {
    const output = buildGardenExportWorkbook({
      gardens: [garden({ id: "empty", name: "Empty", cultivationMethod: null })],
      plants: [
        plant({
          plantedOn: null,
          plantedDatePrecision: "unknown",
          backendPositionId: "position-4",
        }),
      ],
      events: [],
      language: "es",
      exportDate: new Date(2026, 8, 30, 12),
    });
    const entries = await storedZipEntries(output.blob);
    const sheet = entries.get("xl/worksheets/sheet1.xml") ?? "";
    expect(sheet).toContain("No registrado");
    expect(sheet).toContain("H1P1");
    expect(sheet).toContain("Pod 4");
    expect(sheet).toContain("Total days");
    expect(sheet).not.toContain('r="E10"');
  });

  it("does not create a workbook without owned Gardens", () => {
    expect(() =>
      buildGardenExportWorkbook({ gardens: [], plants: [], events: [], language: "en" }),
    ).toThrow("There are no gardens to export.");
  });
});
