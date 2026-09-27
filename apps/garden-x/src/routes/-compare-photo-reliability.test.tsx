// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Photo, Plant } from "@/lib/garden-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: { plantId: "plant-a" },
  search: {},
  store: {} as Record<string, unknown>,
  resolvePhotoUrl: vi.fn(),
  persistPhotoRendition: vi.fn(),
  runAiCheck: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    options,
    useParams: () => mocks.params,
    useSearch: () => mocks.search,
  }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/lib/garden-backend", () => ({
  resolvePhotoUrl: mocks.resolvePhotoUrl,
  persistPhotoRendition: mocks.persistPhotoRendition,
  runAiCheck: mocks.runAiCheck,
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

import { Route } from "./plants.$plantId.compare";

function CompareRoute() {
  const Component = Route.options.component as React.ComponentType;
  return <Component />;
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
    mocks.runAiCheck.mockReset().mockRejectedValue(new Error("AI unavailable"));
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

  it("resolves both selected sides independently and keeps the other side visible after one preferred rendition fails", async () => {
    mocks.resolvePhotoUrl.mockImplementation((item: Photo, rendition: string) => {
      if (item.id === "before" && rendition === "display")
        return Promise.reject(new Error("missing display sidecar"));
      return Promise.resolve(`https://signed/${item.id}/${rendition}`);
    });
    const { container } = render(<CompareRoute />);

    await waitFor(() => {
      expect(container.querySelector('img[alt="before caption"]')?.getAttribute("src")).toBe(
        "https://signed/before/original",
      );
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
});
