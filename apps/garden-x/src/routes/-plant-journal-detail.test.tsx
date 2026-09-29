// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Garden, Plant, PlantEvent, PlantOriginType } from "@/lib/garden-data";
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
    useSearch: () => ({}),
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
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext({
    open: false,
    onOpenChange: (_open: boolean) => undefined,
  });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) =>
      React.createElement(DialogContext.Provider, { value: { open, onOpenChange }, children }),
    DialogContent: ({ children }: { children: ReactNode }) =>
      React.useContext(DialogContext).open
        ? React.createElement("div", { role: "dialog" }, children)
        : null,
    DialogDescription: ({ children }: { children: ReactNode }) => React.createElement("p", null, children),
    DialogFooter: ({ children }: { children: ReactNode }) => React.createElement("div", null, children),
    DialogHeader: ({ children }: { children: ReactNode }) => React.createElement("header", null, children),
    DialogTitle: ({ children }: { children: ReactNode }) => React.createElement("h2", null, children),
  };
});
vi.mock("@/components/ui/radio-group", async () => {
  const React = await import("react");
  const RadioContext = React.createContext({
    value: "",
    onValueChange: (_value: string) => undefined,
  });
  return {
    RadioGroup: ({ value, onValueChange, children, "aria-label": label }: { value: string; onValueChange: (value: string) => void; children: ReactNode; "aria-label"?: string }) =>
      React.createElement(
        RadioContext.Provider,
        { value: { value, onValueChange } },
        React.createElement("div", { role: "radiogroup", "aria-label": label }, children),
      ),
    RadioGroupItem: ({ id, value }: { id: string; value: string }) => {
      const group = React.useContext(RadioContext);
      return React.createElement("input", {
        id,
        type: "radio",
        value,
        checked: group.value === value,
        onChange: () => group.onValueChange(value),
      });
    },
  };
});
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
    updatePlantOrigin: vi.fn().mockResolvedValue(undefined),
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
    expect(heroMeta).toContain("Unknown");
    expect(heroMeta).toContain("Day 18");
    expect(heroMeta).toContain("Pod 1");
    const originButton = screen.getByRole("button", { name: "Set or correct plant origin" });
    expect(originButton.className).not.toMatch(/\bunderline\b/);
    expect(originButton.querySelector("svg")).toBeTruthy();
  });

  it("lets the user resolve unknown Origin and keeps the hero metadata compact after success", async () => {
    const fixture = storeFixture();
    fixture.historicalPlants = [{ ...plant, originType: "unknown" }];
    fixture.updatePlantOrigin = vi.fn(async (_plantId: string, origin: Exclude<PlantOriginType, "unknown">) => {
      fixture.historicalPlants = [{ ...plant, originType: origin }];
    });
    mocks.store = fixture;
    const Component = DetailRoute.options.component as React.ComponentType;
    const { container, rerender } = render(<Component />);

    fireEvent.click(screen.getByRole("button", { name: "Set or correct plant origin" }));
    fireEvent.click(screen.getByRole("radio", { name: "Seed" }));
    fireEvent.click(screen.getByRole("button", { name: "Save origin" }));
    await waitFor(() => expect(fixture.updatePlantOrigin).toHaveBeenCalledWith(plant.id, "seed"));
    rerender(<Component />);

    const heroMeta = container.querySelector(".absolute.inset-x-0.bottom-0")?.textContent ?? "";
    expect(heroMeta).toContain("Seed");
    expect(heroMeta).toContain("Day 18");
    expect(heroMeta).toContain("Pod 1");
    expect(heroMeta.match(/Day 18/g)).toHaveLength(1);
  });

  it("allows correcting a known Origin and cancel leaves it unchanged", async () => {
    const fixture = storeFixture();
    mocks.store = fixture;
    const { container } = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Set or correct plant origin" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cutting" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixture.updatePlantOrigin).not.toHaveBeenCalled();
    expect(container.querySelector(".absolute.inset-x-0.bottom-0")?.textContent).toContain("Bare root");

    fireEvent.click(screen.getByRole("button", { name: "Set or correct plant origin" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cutting" }));
    fireEvent.click(screen.getByRole("button", { name: "Save origin" }));
    await waitFor(() => expect(fixture.updatePlantOrigin).toHaveBeenCalledWith(plant.id, "cutting"));
  });

  it("keeps the current Origin visible when the canonical save fails", async () => {
    const fixture = storeFixture();
    fixture.updatePlantOrigin.mockRejectedValue(new Error("network unavailable"));
    mocks.store = fixture;
    const { container } = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Set or correct plant origin" }));
    fireEvent.click(screen.getByRole("radio", { name: "Transplant" }));
    fireEvent.click(screen.getByRole("button", { name: "Save origin" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    const heroMeta = container.querySelector(".absolute.inset-x-0.bottom-0")?.textContent ?? "";
    expect(heroMeta).toContain("Bare root");
    expect(heroMeta).toContain("Day 18");
    expect(heroMeta).toContain("Pod 1");
  });

  it("localizes the Origin selector labels and stable choices in Spanish", () => {
    mocks.store = {
      ...storeFixture("es"),
      historicalPlants: [{ ...plant, originType: "unknown" }],
    };
    renderDetail();
    expect(screen.getByRole("button", { name: "Definir o corregir el origen de la planta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Definir o corregir el origen de la planta" }));
    expect(screen.getByRole("radio", { name: "Semilla" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Raíz desnuda" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Esqueje" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Plántula" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Trasplante" })).toBeTruthy();
  });

  it("allows the parent Plant route to resolve a closed historical cycle", () => {
    const Layout = LayoutRoute.options.component as React.ComponentType;
    render(<Layout />);
    expect(screen.getByText("Outlet")).toBeTruthy();
  });
});
