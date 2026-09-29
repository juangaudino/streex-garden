// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Photo, Plant } from "@/lib/garden-data";
import { validateComparePhotoSearch } from "@/lib/compare-photo-selection";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: { plantId: "plant-a" },
  search: {},
  store: {} as Record<string, unknown>,
  resolvePhotoUrl: vi.fn(),
  persistPhotoRendition: vi.fn(),
  reportPhotoMediaDiagnostic: vi.fn(),
  requestMeaningfulChange: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
      options,
      useParams: () => mocks.params,
      useSearch: () => mocks.search,
    }),
    Link: ({
      to,
      children,
      search,
      ...props
    }: {
      to: string;
      children: ReactNode;
      search?: Record<string, unknown>;
    }) => (
      <a href={to} data-search={search ? JSON.stringify(search) : undefined} {...props}>
        {children}
      </a>
    ),
    notFound: () => {
      throw new Error("Not found");
    },
  };
});
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/lib/garden-backend", () => ({
  resolvePhotoUrl: mocks.resolvePhotoUrl,
  persistPhotoRendition: mocks.persistPhotoRendition,
  reportPhotoMediaDiagnostic: mocks.reportPhotoMediaDiagnostic,
  requestMeaningfulChange: mocks.requestMeaningfulChange,
}));
vi.mock("@/lib/garden-logic", () => ({
  ageLabel: (value: number) => `age-${value}`,
  comparePhotos: () => ({
    days: 10,
    observations: ["Observed"],
    inference: "Recorded change",
    confidence: "moderate",
    deltas: [],
  }),
  eventsBetween: () => [],
  formatDate: (value: number) => `date-${value}`,
  plantPhotos: (photos: Photo[], plantId: string) =>
    photos.filter((photo) => photo.plantId === plantId),
}));
vi.mock("@/components/garden/atoms", () => ({
  ConfidenceBar: () => null,
  ProvenanceTag: () => null,
}));

import { CompareScreen } from "./plants.$plantId.compare";

function CompareRoute() {
  return (
    <CompareScreen
      plantId={mocks.params.plantId}
      search={validateComparePhotoSearch(mocks.search)}
    />
  );
}

const plant = (id: string): Plant => ({
  id,
  gardenId: "garden-a",
  name: id,
  species: "Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "lettuce",
  plantedDaysAgo: 40,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  slot: "Pod 1",
  backendGrowCycleId: `cycle-${id}`,
});

const photo = (plantId: string, id: string, daysAgo: number): Photo => ({
  id,
  plantId,
  src: "",
  daysAgo,
  caption: `${id} caption`,
  backendStoragePath: `owner/${id}/original.jpg`,
  backendGrowCycleId: `cycle-${plantId}`,
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
});

class OffscreenObserver {
  observe() {}
  disconnect() {}
}

describe("Compare photo loading", () => {
  beforeEach(() => {
    mocks.params = { plantId: "plant-a" };
    mocks.search = {};
    mocks.resolvePhotoUrl.mockReset();
    mocks.persistPhotoRendition.mockReset();
    mocks.reportPhotoMediaDiagnostic.mockReset();
    mocks.requestMeaningfulChange.mockReset().mockRejectedValue(new Error("AI unavailable"));
    vi.stubGlobal("IntersectionObserver", OffscreenObserver);
    mocks.store = {
      language: "en",
      plants: [plant("plant-a"), plant("plant-b")],
      historicalPlants: [],
      photos: [
        photo("plant-a", "before", 30),
        photo("plant-a", "middle", 20),
        photo("plant-a", "after", 10),
        photo("plant-b", "other-first", 25),
        photo("plant-b", "other-last", 5),
      ],
      events: [],
    };
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("resolves both selected sides independently and never substitutes the master", async () => {
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) => {
      if (item.id === "before" && rendition === "display")
        return Promise.reject(new Error("missing display sidecar"));
      return Promise.resolve(`https://signed/${item.id}/${rendition}`);
    });
    const { container } = render(<CompareRoute />);

    await waitFor(() => {
      expect(container.querySelector('[data-photo-state="error"]')).toBeTruthy();
      expect(container.querySelector('img[alt="after caption"]')?.getAttribute("src")).toBe(
        "https://signed/after/display",
      );
    });
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: "before" }),
      "display",
      expect.any(Object),
    );
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: "after" }),
      "display",
      expect.any(Object),
    );
  });

  it("does not retain a stale main image when the user rapidly selects another date", async () => {
    const pending = new Map<string, Array<(value: string) => void>>();
    mocks.resolvePhotoUrl.mockImplementation(
      (item: Photo) =>
        new Promise((resolve) => {
          const existing = pending.get(item.id) ?? [];
          existing.push(resolve);
          pending.set(item.id, existing);
        }),
    );
    const { container } = render(<CompareRoute />);
    fireEvent.click(screen.getByRole("button", { name: "Earlier photo: middle caption" }));

    pending.get("before")?.[0]?.("https://signed/stale-before");
    pending.get("middle")?.at(-1)?.("https://signed/current-middle");
    await waitFor(() => {
      const mainEarlier = container.querySelector<HTMLImageElement>(
        'img[alt="middle caption"].h-full',
      );
      expect(mainEarlier?.getAttribute("src")).toBe("https://signed/current-middle");
    });
  });

  it("uses only the new plant's photos when the route changes", async () => {
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) =>
      Promise.resolve(`https://signed/${item.id}/${rendition}`),
    );
    const { container, rerender } = render(<CompareRoute />);
    mocks.params = { plantId: "plant-b" };
    rerender(<CompareRoute />);

    expect(await screen.findByRole("heading", { name: /plant-b/ })).toBeTruthy();
    await waitFor(() => {
      expect(container.querySelector('img[alt="other-first caption"]')?.getAttribute("src")).toBe(
        "https://signed/other-first/display",
      );
      expect(container.querySelector('img[alt="other-last caption"]')?.getAttribute("src")).toBe(
        "https://signed/other-last/display",
      );
    });
    expect(container.querySelector('img[alt="before caption"]')).toBeNull();
  });

  it("initializes from the exact valid before/after photo IDs in the existing Compare route", async () => {
    mocks.search = { beforePhotoId: "middle", afterPhotoId: "after" };
    mocks.store.events = [{
      id: "event-between",
      plantId: "plant-a",
      daysAgo: 15,
      occurredAt: "2026-09-14",
      type: "note",
      title: "Recorded event",
      provenance: "recorded",
    }];
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) =>
      Promise.resolve(`https://signed/${item.id}/${rendition}`),
    );
    const { container } = render(<CompareRoute />);

    await waitFor(() => {
      expect(container.querySelector('img[alt="middle caption"].h-full')?.getAttribute("src")).toBe(
        "https://signed/middle/display",
      );
      expect(container.querySelector('img[alt="after caption"]')?.getAttribute("src")).toBe(
        "https://signed/after/display",
      );
    });
    expect(mocks.requestMeaningfulChange).not.toHaveBeenCalled();
    mocks.requestMeaningfulChange.mockResolvedValue({
      proposal: {
        analysisVersion: "garden_meaningful_change_v1",
        comparisonStatus: "meaningful_change",
        primaryVisualObservation: "AI observation",
        supportingVisualObservations: [],
        comparabilityNotes: [],
        interpretation: "AI inference",
        interpretationConfidence: "high",
        relevantContextFacts: [],
        beforePhotoId: "middle",
        afterPhotoId: "after",
        growCycleId: "cycle-plant-a",
        plantInstanceId: "plant-a",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run AI Compare" }));
    await waitFor(() =>
      expect(mocks.requestMeaningfulChange).toHaveBeenCalledWith("cycle-plant-a", "middle", "after", "en"),
    );
    expect(await screen.findByText(/AI observation/)).toBeTruthy();
    const evidenceSearches = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[data-search]"))
      .map((link) => link.dataset.search);
    expect(evidenceSearches).toContain(JSON.stringify({ tab: "Photos", focusPhotoId: "middle" }));
    expect(evidenceSearches).toContain(JSON.stringify({ tab: "Photos", focusPhotoId: "after" }));
    expect(evidenceSearches).toContain(JSON.stringify({ tab: "Timeline", focusEventId: "event-between" }));
  });

  it("does not invoke AI on open or selection change, and ignores an in-flight result for the old pair", async () => {
    let finishOldRequest:
      | ((value: {
          proposal: {
            analysisVersion: string;
            comparisonStatus: "meaningful_change";
            primaryVisualObservation: string;
            supportingVisualObservations: string[];
            comparabilityNotes: string[];
            interpretation: string;
            interpretationConfidence: "high";
            relevantContextFacts: string[];
            beforePhotoId: string;
            afterPhotoId: string;
            growCycleId: string;
            plantInstanceId: string;
          };
        }) => void)
      | undefined;
    mocks.requestMeaningfulChange.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOldRequest = resolve;
        }),
    );
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) =>
      Promise.resolve(`https://signed/${item.id}/${rendition}`),
    );
    render(<CompareRoute />);
    expect(mocks.requestMeaningfulChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Earlier photo: middle caption" }));
    expect(mocks.requestMeaningfulChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Run AI Compare" }));
    expect(mocks.requestMeaningfulChange).toHaveBeenCalledWith("cycle-plant-a", "middle", "after", "en");
    fireEvent.click(screen.getByRole("button", { name: "Earlier photo: before caption" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Run AI Compare" }).hasAttribute("disabled")).toBe(
        true,
      ),
    );
    expect(mocks.requestMeaningfulChange).toHaveBeenCalledTimes(1);
    finishOldRequest?.({
      proposal: {
        analysisVersion: "garden_meaningful_change_v1",
        comparisonStatus: "meaningful_change",
        primaryVisualObservation: "stale AI observation",
        supportingVisualObservations: [],
        comparabilityNotes: [],
        interpretation: "stale inference",
        interpretationConfidence: "high",
        relevantContextFacts: [],
        beforePhotoId: "middle",
        afterPhotoId: "after",
        growCycleId: "cycle-plant-a",
        plantInstanceId: "plant-a",
      },
    });
    await waitFor(() => expect(screen.queryByText("stale AI observation")).toBeNull());
  });

  it("falls back to Compare's normal oldest/newest selection for stale or cross-plant IDs", async () => {
    mocks.search = { beforePhotoId: "other-first", afterPhotoId: "after" };
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) =>
      Promise.resolve(`https://signed/${item.id}/${rendition}`),
    );
    const { container } = render(<CompareRoute />);

    await waitFor(() => {
      expect(container.querySelector('img[alt="before caption"].h-full')?.getAttribute("src")).toBe(
        "https://signed/before/display",
      );
      expect(container.querySelector('img[alt="after caption"]')?.getAttribute("src")).toBe(
        "https://signed/after/display",
      );
    });
  });
});
