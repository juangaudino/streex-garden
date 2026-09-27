// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Photo } from "@/lib/garden-data";
import { HomeJournalView } from "@/components/garden/home-journal-view";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options }),
    Link: ({
      to,
      params,
      children,
      search,
      ...props
    }: {
      to: string;
      params?: Record<string, string>;
      children: ReactNode;
      search?: unknown;
    }) => {
      const plantPath = `/plants/${params?.["plantId"]}`;
      const href =
        to === "/gardens/$gardenId"
          ? `/gardens/${params?.["gardenId"]}`
          : to === "/plants/$plantId/compare"
            ? `${plantPath}/compare`
            : plantPath;
      return (
        <a href={href} data-search={search ? JSON.stringify(search) : undefined} {...props}>
          {children}
        </a>
      );
    },
  };
});
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/components/garden/shell", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header data-testid="home-ready">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));
vi.mock("@/components/garden/photo-image", () => ({
  PhotoImage: ({ photo, alt = "" }: { photo: Photo; alt?: string }) => (
    <img alt={alt} data-photoid={photo.id} />
  ),
}));
vi.mock("@/components/garden/garden-summary", () => ({ GardenSummaryCard: () => null }));
vi.mock("@/components/garden/atoms", () => ({
  ProvenanceTag: () => null,
  SectionTitle: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div>
      <h2>{children}</h2>
      {action}
    </div>
  ),
  StatusDot: () => null,
  PlantThumb: () => null,
  eventIcons: { maintenance: () => <svg /> },
  maintenanceIcons: { watering: () => <svg /> },
}));

function HomeRoute() {
  return <HomeJournalView />;
}

afterEach(() => {
  cleanup();
  mocks.store = {};
});

describe("Home recent activity", () => {
  it("omits operational maintenance from Journal activity", async () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
      ],
      plants: [
        {
          id: "plant-a",
          gardenId: "garden-a",
          name: "Lettuce",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 12,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
          slot: "Pod 1",
        },
      ],
      profile: { name: "Juan", signedIn: true },
      tasks: [],
      events: [
        {
          id: "garden-event-1",
          plantId: "",
          gardenId: "garden-a",
          daysAgo: 0,
          type: "maintenance",
          title: "Water + nutrients",
          provenance: "recorded",
        },
      ],
      photos: [],
      meaningfulChanges: [],
      gardenSummaries: [],
    };

    render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.queryByText("Water + nutrients")).toBeNull();
  });

  it("skips orphaned plant-only events instead of crashing Home", async () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
      ],
      plants: [
        {
          id: "plant-a",
          gardenId: "garden-a",
          name: "Lettuce",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 12,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
          slot: "Pod 1",
        },
      ],
      profile: { name: "Juan", signedIn: true },
      tasks: [
        {
          id: "orphan-task",
          plantId: "missing-plant",
          type: "watering",
          label: "Water",
          dueInDays: 0,
          done: false,
        },
      ],
      events: [
        {
          id: "orphan-event",
          plantId: "missing-plant",
          daysAgo: 0,
          type: "note",
          title: "Stale event",
          provenance: "recorded",
        },
      ],
      photos: [],
      meaningfulChanges: [],
      gardenSummaries: [],
    };

    render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.queryByText("Stale event")).toBeNull();
    expect(screen.getAllByText("Lettuce").length).toBeGreaterThan(0);
  });

  it("projects a Moment with a note, Life Event and photo as one activity row", async () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
      ],
      plants: [
        {
          id: "plant-a",
          gardenId: "garden-a",
          name: "Lettuce",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 12,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
          slot: "Pod 1",
          backendGrowCycleId: "cycle-a",
        },
      ],
      historicalPlants: [],
      profile: { name: "Juan", signedIn: true },
      events: [
        {
          id: "moment",
          plantId: "plant-a",
          daysAgo: 2,
          occurredAt: "2026-09-25T12:00:00Z",
          type: "harvest",
          title: "Harvested",
          detail: "Testing",
          lifeEvent: "harvested",
          photoIds: ["attached-photo"],
          provenance: "recorded",
        },
      ],
      photos: [
        {
          id: "attached-photo",
          plantId: "plant-a",
          src: "",
          daysAgo: 2,
          caption: "Testing",
          backendEventId: "moment",
          backendGrowCycleId: "cycle-a",
          mediaScope: "cycle_evidence",
          backendStoragePath: "owner/photo/original.jpg",
          metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
        },
      ],
      tasks: [],
    };

    const { container } = render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.getAllByText("Harvested")).toHaveLength(1);
    expect(container.querySelectorAll("ul li")).toHaveLength(1);
  });

  it("shows four recent factual items first and expands/collapses inline", async () => {
    const plant = (id: string) => ({
      id,
      gardenId: "garden-a",
      name: id,
      species: "Lettuce",
      scientific: "Lactuca sativa",
      variety: "",
      knowledgeId: "lettuce",
      plantedDaysAgo: 12,
      status: "steady",
      statusNote: "",
      heroPhotoId: "",
      identityConfirmed: true,
      slot: "Pod 1",
    });
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
      ],
      plants: [
        plant("plant-1"),
        plant("plant-2"),
        plant("plant-3"),
        plant("plant-4"),
        plant("plant-5"),
        plant("plant-6"),
      ],
      historicalPlants: [],
      profile: { name: "Juan", signedIn: true },
      events: Array.from({ length: 6 }, (_, index) => ({
        id: `event-${index}`,
        plantId: `plant-${index + 1}`,
        daysAgo: index,
        type: "note",
        title: `Moment ${index + 1}`,
        detail: "A note",
        provenance: "recorded",
      })),
      photos: [],
      tasks: [],
    };

    render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.getByText("Moment 1")).toBeTruthy();
    expect(screen.getByText("Moment 4")).toBeTruthy();
    expect(screen.queryByText("Moment 5")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByText("Moment 6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("Moment 6")).toBeNull();
  });

  it("counts active plants and only non-archived gardens in the greeting", async () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
        { id: "garden-b", name: "Garden B", kind: "hydroponic", cover: "", place: "", note: "" },
        {
          id: "old",
          name: "Archived",
          kind: "hydroponic",
          cover: "",
          place: "",
          note: "",
          archived: true,
        },
      ],
      plants: [
        {
          id: "active-a",
          gardenId: "garden-a",
          name: "A",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 4,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
        },
        {
          id: "active-b",
          gardenId: "garden-b",
          name: "B",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 4,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
        },
        {
          id: "ended",
          gardenId: "garden-a",
          name: "Ended",
          species: "Lettuce",
          scientific: "Lactuca sativa",
          variety: "",
          knowledgeId: "lettuce",
          plantedDaysAgo: 4,
          status: "steady",
          statusNote: "",
          heroPhotoId: "",
          identityConfirmed: true,
          cycleClosed: true,
        },
      ],
      profile: { name: "Juan", signedIn: true },
      events: [],
      photos: [],
      tasks: [],
    };

    render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.getByText("2 plants across 2 gardens.")).toBeTruthy();
  });

  it("shows factual before/after photos and links the selected pair to the existing Compare route", async () => {
    const now = new Date();
    const afterDate = now.toISOString();
    const beforeDate = new Date(now.getTime() - 4 * 86_400_000).toISOString();
    const plant = {
      id: "plant-a",
      gardenId: "garden-a",
      name: "Lettuce",
      species: "Lettuce",
      scientific: "Lactuca sativa",
      variety: "",
      knowledgeId: "lettuce",
      plantedDaysAgo: 12,
      status: "steady",
      statusNote: "",
      heroPhotoId: "after",
      identityConfirmed: true,
      slot: "Pod 1",
      backendGrowCycleId: "cycle-a",
    };
    const photo = (id: string, capturedAt: string): Photo => ({
      id,
      plantId: plant.id,
      src: "",
      daysAgo: 0,
      caption: id,
      mediaScope: "cycle_evidence",
      backendStoragePath: `owner/${id}/original.jpg`,
      backendGrowCycleId: plant.backendGrowCycleId,
      capturedAt,
      provenance: "recorded",
      metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
    });
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [
        { id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" },
      ],
      plants: [plant],
      historicalPlants: [],
      profile: { name: "Juan", signedIn: true },
      events: [],
      photos: [photo("before", beforeDate), photo("after", afterDate)],
      tasks: [],
    };

    const { container } = render(<HomeRoute />);

    await screen.findByTestId("home-ready");
    expect(screen.getByText(/Before ·/)).toBeTruthy();
    expect(screen.getByText(/After ·/)).toBeTruthy();
    expect(screen.getByText("4 days between photos")).toBeTruthy();
    const compareLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/plants/plant-a/compare"]',
    );
    expect(compareLink?.getAttribute("data-search")).toBe(
      JSON.stringify({
        from: undefined,
        beforePhotoId: "before",
        afterPhotoId: "after",
      }),
    );
  });
});
