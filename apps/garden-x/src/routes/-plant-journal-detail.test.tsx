// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Garden, Plant, PlantEvent } from "@/lib/garden-data";
import { Route as LayoutRoute } from "./plants.$plantId";
import { Route as DetailRoute } from "./plants.$plantId.index";

const mocks = vi.hoisted(() => ({
  params: { plantId: "plant-1" },
  store: {} as Record<string, unknown>,
  openRecord: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    options,
    useParams: () => mocks.params,
  }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div>Outlet</div>,
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/lib/garden-logic", () => ({
  chronological: (events: PlantEvent[]) => [...events].sort((a, b) => b.daysAgo - a.daysAgo),
  dueLabel: () => "today",
  localizedEventLabel: (type: string) => type,
  formatDate: (daysAgo: number) => `date-${daysAgo}`,
  localizedMaintenanceLabel: (type: string) => type,
  openTasks: () => [],
  plantEvents: (events: PlantEvent[], plantId: string) =>
    events.filter((event) => event.plantId === plantId),
  plantPhotos: (photos: Array<{ plantId: string }>, plantId: string) =>
    photos.filter((photo) => photo.plantId === plantId),
  relativeDay: (daysAgo: number) => `${daysAgo} days ago`,
  isRedundantTimelineDetail: () => false,
  isTimelineTitleProjectionOfDetail: () => false,
  normalizeTimelineNote: (text: string) => text,
  latestPlantPhoto: () => undefined,
  plantTimeline: (events: PlantEvent[], _photos: unknown[], plantId: string) =>
    events
      .filter((event) => event.plantId === plantId)
      .map((event) => ({ kind: "event", event, photos: [], daysAgo: event.daysAgo })),
  sortPhotosByCapturedAt: (photos: unknown[]) => photos,
  photoMetricEntries: () => [],
}));
vi.mock("@/lib/garden-library", () => ({
  loadGardenLibraryCatalog: vi.fn(() => Promise.resolve({ entries: [] })),
  localizedLibraryName: (entry: { commonName: string }) => entry.commonName,
}));
vi.mock("@/lib/plant-identity", () => ({
  plantIdentityParts: (plant: Plant) => ({
    commonName: plant.species,
    scientificName: plant.scientific,
    cultivar: plant.variety,
  }),
}));
vi.mock("@/lib/care-session", () => ({ askGardenAccentClassName: "ask-accent" }));
vi.mock("@/components/garden/journal-entry-context", () => ({
  useJournalEntry: () => mocks.openRecord,
}));
vi.mock("@/components/garden/record-moment", () => ({
  RecordMomentSheet: () => null,
  careShortcuts: () => [],
}));
vi.mock("@/components/garden/share-story", () => ({ HistoryShareDialog: () => null }));
vi.mock("@/components/garden/photo-viewer", () => ({
  usePhotoViewer: () => ({ openPhoto: vi.fn(), viewer: null }),
}));
vi.mock("@/components/garden/photo-image", () => ({
  PhotoImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("@/components/garden/atoms", () => ({
  ProvenanceTag: () => <span>Recorded fact</span>,
  SectionTitle: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div>
      <h2>{children}</h2>
      {action}
    </div>
  ),
  eventIcons: new Proxy({}, { get: () => () => <span aria-hidden="true">event</span> }),
  maintenanceIcons: new Proxy({}, { get: () => () => <span aria-hidden="true">care</span> }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/garden/chronology-select", () => ({ ChronologySelect: () => null }));
vi.mock("@/components/garden/delete-action-menu", () => ({ DeleteActionMenu: () => null }));
vi.mock("@/components/garden/library-identity-resolution", () => ({
  LibraryIdentityResolution: () => null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Iceberg Lettuce",
  species: "Iceberg Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "lettuce",
  originType: "bare_root",
  plantedDatePrecision: "exact",
  plantedDaysAgo: 18,
  slot: "Pod 1",
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  cycleClosed: true,
  backendGrowCycleId: "cycle-1",
};
const garden: Garden = {
  id: "garden-1",
  name: "Garden One",
  kind: "hydroponic",
  cover: "",
  place: "",
  note: "",
};

function storeFixture(language: "en" | "es" = "en") {
  const ended: PlantEvent = {
    id: "ended-1",
    plantId: plant.id,
    gardenId: garden.id,
    daysAgo: 2,
    type: "note",
    lifeEvent: "ended",
    title: "Harvest completed",
    detail: "Cycle closed after harvest.",
    provenance: "recorded",
  };
  const firstHarvest: PlantEvent = {
    id: "harvest-1",
    plantId: plant.id,
    daysAgo: 7,
    type: "harvest",
    lifeEvent: "harvested",
    title: "Harvested",
    provenance: "recorded",
  };
  const maintenance: PlantEvent = {
    id: "maintenance-1",
    plantId: plant.id,
    gardenId: garden.id,
    daysAgo: 4,
    type: "maintenance",
    title: "Water change",
    provenance: "recorded",
  };
  return {
    language,
    gardens: [garden],
    plants: [],
    historicalPlants: [plant],
    photos: [],
    events: [ended, firstHarvest, maintenance],
    tasks: [],
    films: [],
    deleteEvent: vi.fn(),
    deletePhoto: vi.fn(),
    addEvent: vi.fn(),
  };
}

function renderDetail() {
  const Component = DetailRoute.options.component as React.ComponentType;
  return render(<Component />);
}

describe("Plant Detail journal-first presentation", () => {
  beforeEach(() => {
    mocks.params = { plantId: plant.id };
    mocks.store = storeFixture();
    mocks.openRecord.mockReset();
  });
  afterEach(() => cleanup());

  it("renders a closed-cycle journal from the historical plant projection with origin/day/pod and no duplicate Record", () => {
    const { container } = renderDetail();
    const heroMeta = container.querySelector(".absolute.inset-x-0.bottom-0")?.textContent ?? "";
    expect(heroMeta).toContain("Bare root");
    expect(heroMeta).toContain("Day 18");
    expect(heroMeta).toContain("Pod 1");
    expect(heroMeta.match(/Day 18/g)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Journal" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Life highlights" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "AI Check" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Compare" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask Garden" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record a moment" })).toBeNull();
    expect(screen.queryByText("Steady")).toBeNull();
    expect(screen.getByText("Harvest completed")).toBeTruthy();
  });

  it("renames History to Diario in Spanish and keeps recorded maintenance neutral in Timeline", () => {
    mocks.store = storeFixture("es");
    renderDetail();
    expect(screen.getByRole("button", { name: "Diario" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Momentos destacados" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Línea de tiempo" }));
    expect(screen.getByText("Actividad registrada · 4 days ago")).toBeTruthy();
    expect(screen.getByText("Water change")).toBeTruthy();
  });

  it("shows an unknown origin honestly instead of silently omitting or guessing it", () => {
    mocks.store = {
      ...storeFixture(),
      historicalPlants: [{ ...plant, originType: "unknown" }],
    };
    const { container } = renderDetail();
    const heroMeta = container.querySelector(".absolute.inset-x-0.bottom-0")?.textContent ?? "";
    expect(heroMeta).toContain("Not recorded");
    expect(heroMeta).toContain("Day 18");
    expect(heroMeta).toContain("Pod 1");
  });

  it("allows the parent Plant route to resolve a closed historical cycle", () => {
    const Layout = LayoutRoute.options.component as React.ComponentType;
    render(<Layout />);
    expect(screen.getByText("Outlet")).toBeTruthy();
  });
});
