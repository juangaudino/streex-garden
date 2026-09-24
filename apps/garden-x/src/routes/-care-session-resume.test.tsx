// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneElement, isValidElement, type ReactNode } from "react";
import type { Garden, Plant } from "@/lib/garden-data";
import { clearCareSession } from "@/lib/care-session";
import { Route } from "./care";

const mocks = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    options,
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/components/garden/record-moment", () => ({ RecordMomentSheet: () => null }));
vi.mock("@/components/garden/shell", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/garden/photo-image", () => ({
  PhotoImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("@/components/garden/photo-source-picker", () => ({ PhotoSourcePicker: () => null }));
vi.mock("@/components/garden/garden-conversation-composer", () => ({
  GardenConversationComposer: () => null,
}));
vi.mock("@/components/garden/atoms", () => ({
  ConfidenceBar: () => null,
  ProvenanceTag: () => null,
  SectionTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  maintenanceIcons: {},
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: { asChild?: boolean; children: ReactNode } & Record<string, unknown>) =>
    asChild && isValidElement(children) ? (
      cloneElement(children, props)
    ) : (
      <button {...props}>{children}</button>
    ),
}));
vi.mock("@/lib/garden-backend", () => ({ runAiCheckDraft: vi.fn(), askGardenAi: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const gardens: Garden[] = [
  {
    id: "garden-a",
    name: "Garden A",
    kind: "hydroponic",
    cover: "",
    place: "",
    note: "",
    backendPositions: [1, 2, 3].map((number) => ({ id: `position-${number}`, number })),
  },
];
const plants: Plant[] = [1, 2, 3].map((number) => ({
  id: `plant-${number}`,
  gardenId: "garden-a",
  name: `Plant ${number}`,
  species: "Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "lettuce",
  plantedDaysAgo: 20,
  status: "steady",
  statusNote: "",
  heroPhotoId: null,
  identityConfirmed: true,
  backendGrowCycleId: `cycle-${number}`,
  backendPositionId: `position-${number}`,
  slot: `Pod ${number}`,
}));

function storeFixture() {
  return {
    language: "en" as const,
    hydration: "ready" as const,
    plants,
    gardens,
    photos: [],
    events: [],
    tasks: [],
    careInspection: null,
    clearCareInspection: vi.fn(),
    patchCareInspection: vi.fn(),
    addEvent: vi.fn().mockResolvedValue(undefined),
  };
}

function CareRoute() {
  const Component = Route.options.component as React.ComponentType;
  return <Component />;
}

describe("Care Session route resume flow", () => {
  beforeEach(() => {
    clearCareSession();
    mocks.search = {};
    mocks.navigate.mockReset();
    mocks.store = storeFixture();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });
  afterEach(() => {
    cleanup();
    clearCareSession();
    vi.unstubAllGlobals();
  });

  it("starts, reviews, leaves and resumes the same ordered session at its next pending plant", async () => {
    const store = mocks.store as ReturnType<typeof storeFixture>;
    const { unmount } = render(<CareRoute />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(await screen.findByText("Plant 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Looks good" }));
    await waitFor(() => expect(store.addEvent).toHaveBeenCalledTimes(1));
    expect(store.addEvent.mock.calls[0]?.[0]).toMatchObject({
      type: "note",
      backendEventType: "visual_review",
      title: "Reviewed — looks good",
      provenance: "observed",
    });
    fireEvent.click(screen.getByRole("button", { name: "Next plant" }));
    expect(await screen.findByText("Plant 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByText("Plant 3")).toBeTruthy();
    await waitFor(() =>
      expect(localStorage.getItem("garden-x-care-session-v1")).toContain('"index":2'),
    );

    unmount();
    mocks.search = {};
    render(<CareRoute />);
    expect(await screen.findByText("1 / 3 plants reviewed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue session" }));
    expect(await screen.findByText("Plant 3")).toBeTruthy();
    expect(screen.getByText("1 / 3 plants reviewed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue session" })).toBeNull();
    expect(store.clearCareInspection).toHaveBeenCalled();
  });

  it("requires confirmation before replacing an unfinished session", async () => {
    localStorage.setItem(
      "garden-x-care-session-v1",
      JSON.stringify({
        queue: ["plant-1", "plant-2"],
        index: 1,
        recordedForReview: false,
        reviewed: 1,
        observations: 0,
        care: 0,
        followups: 0,
        gardenOrder: ["garden-a"],
        selectedGardenIds: ["garden-a"],
      }),
    );
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(<CareRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Start a new session" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue session" })).toBeTruthy();
    expect(screen.queryByText("Plant 1")).toBeNull();
  });

  it("falls back to Care setup and clears a corrupt or pre-deploy partial snapshot", async () => {
    localStorage.setItem("garden-x-care-session-v1", JSON.stringify({ queue: ["plant-1"], index: 0 }));
    expect(() => render(<CareRoute />)).not.toThrow();
    expect(await screen.findByRole("button", { name: "Start session" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue session" })).toBeNull();
    expect(localStorage.getItem("garden-x-care-session-v1")).toBeNull();
  });

  it("waits for canonical bootstrap before resolving or discarding a saved session", async () => {
    const store = mocks.store as ReturnType<typeof storeFixture>;
    store.hydration = "loading" as never;
    localStorage.setItem("garden-x-care-session-v1", JSON.stringify({
      queue: ["plant-1", "plant-2"], index: 1, recordedForReview: false,
      reviewed: 1, observations: 0, care: 0, followups: 0,
      gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"],
    }));
    const { rerender } = render(<CareRoute />);
    expect(screen.getByRole("button", { name: "Continue session" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Continue session" }));
    expect(screen.queryByText("Plant 2")).toBeNull();
    expect(localStorage.getItem("garden-x-care-session-v1")).not.toBeNull();

    store.hydration = "ready" as never;
    rerender(<CareRoute />);
    fireEvent.click(screen.getByRole("button", { name: "Continue session" }));
    expect(await screen.findByText("Plant 2")).toBeTruthy();
  });

  it("keeps an active URL session on a safe loading state while plants are unresolved", async () => {
    const store = mocks.store as ReturnType<typeof storeFixture>;
    store.hydration = "loading" as never;
    store.plants = [];
    mocks.search = { careQueue: "plant-1,plant-2", careIndex: 1 };
    const saved = JSON.stringify({
      queue: ["plant-1", "plant-2"], index: 1, recordedForReview: false,
      reviewed: 1, observations: 0, care: 0, followups: 0,
      gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"],
    });
    localStorage.setItem("garden-x-care-session-v1", saved);
    expect(() => render(<CareRoute />)).not.toThrow();
    expect(await screen.findByText("Loading your garden…")).toBeTruthy();
    expect(screen.queryByText("Plant 1")).toBeNull();
    expect(localStorage.getItem("garden-x-care-session-v1")).toBe(saved);
  });

  it("returns stale unresolved sessions to setup without rendering a missing plant", async () => {
    localStorage.setItem("garden-x-care-session-v1", JSON.stringify({
      queue: ["plant-1", "plant-deleted"], index: 1, recordedForReview: false,
      reviewed: 1, observations: 0, care: 0, followups: 0,
      gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"],
    }));
    render(<CareRoute />);
    fireEvent.click(screen.getByRole("button", { name: "Continue session" }));
    expect(await screen.findByRole("button", { name: "Start session" })).toBeTruthy();
    expect(screen.queryByText("Plant 2")).toBeNull();
    expect(localStorage.getItem("garden-x-care-session-v1")).toBeNull();
  });
});
