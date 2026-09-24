// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Route } from "./index";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options }),
  Link: ({ to, params, children, ...props }: { to: string; params?: Record<string, string>; children: ReactNode }) => {
    const href = to === "/gardens/$gardenId" ? `/gardens/${params?.["gardenId"]}` : `/plants/${params?.["plantId"]}`;
    return <a href={href} {...props}>{children}</a>;
  },
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: () => mocks.store }));
vi.mock("@/components/garden/shell", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/garden/photo-image", () => ({ PhotoImage: () => <img alt="" /> }));
vi.mock("@/components/garden/garden-summary", () => ({ GardenSummaryCard: () => null }));
vi.mock("@/components/garden/atoms", () => ({
  ProvenanceTag: () => null,
  SectionTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  StatusDot: () => null,
  PlantThumb: () => null,
  eventIcons: { maintenance: () => <svg /> },
  maintenanceIcons: { watering: () => <svg /> },
}));

function HomeRoute() {
  const Component = Route.options.component as React.ComponentType;
  return <Component />;
}

afterEach(() => {
  cleanup();
  mocks.store = {};
});

describe("Home recent activity", () => {
  it("renders garden-level maintenance without resolving it as a plant event", () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [{ id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" }],
      plants: [{
        id: "plant-a", gardenId: "garden-a", name: "Lettuce", species: "Lettuce", scientific: "Lactuca sativa",
        variety: "", knowledgeId: "lettuce", plantedDaysAgo: 12, status: "steady", statusNote: "", heroPhotoId: "",
        identityConfirmed: true, slot: "Pod 1",
      }],
      highlightedPlantId: "plant-a",
      profile: { name: "Juan", signedIn: true },
      tasks: [],
      events: [{
        id: "garden-event-1", plantId: "", gardenId: "garden-a", daysAgo: 0, type: "maintenance",
        title: "Water + nutrients", provenance: "recorded",
      }],
      photos: [],
      meaningfulChanges: [],
      gardenSummaries: [],
    };

    render(<HomeRoute />);

    expect(screen.getByText("Water + nutrients")).toBeTruthy();
    expect(screen.getByText(/Garden A · whole garden/)).toBeTruthy();
    expect(screen.getByText("Water + nutrients").closest("a")?.getAttribute("href")).toBe("/gardens/garden-a");
  });

  it("skips orphaned plant-only events instead of crashing Home", () => {
    mocks.store = {
      language: "en",
      hydration: "ready",
      gardens: [{ id: "garden-a", name: "Garden A", kind: "hydroponic", cover: "", place: "", note: "" }],
      plants: [{
        id: "plant-a", gardenId: "garden-a", name: "Lettuce", species: "Lettuce", scientific: "Lactuca sativa",
        variety: "", knowledgeId: "lettuce", plantedDaysAgo: 12, status: "steady", statusNote: "", heroPhotoId: "",
        identityConfirmed: true, slot: "Pod 1",
      }],
      highlightedPlantId: "plant-a",
      profile: { name: "Juan", signedIn: true },
      tasks: [{ id: "orphan-task", plantId: "missing-plant", type: "watering", label: "Water", dueInDays: 0, done: false }],
      events: [{ id: "orphan-event", plantId: "missing-plant", daysAgo: 0, type: "note", title: "Stale event", provenance: "recorded" }],
      photos: [],
      meaningfulChanges: [],
      gardenSummaries: [],
    };

    render(<HomeRoute />);

    expect(screen.queryByText("Stale event")).toBeNull();
    expect(screen.getByText("Lettuce")).toBeTruthy();
  });
});
