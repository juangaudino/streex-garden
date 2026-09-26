// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ pathname: "/", store: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: mocks.pathname } }),
}));
vi.mock("@/lib/garden-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/garden-store")>("@/lib/garden-store");
  return { ...actual, useGarden: () => mocks.store };
});
vi.mock("@/components/garden/photo-source-picker", () => ({
  PhotoSourcePicker: ({ onFile }: { onFile: (file: File) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => onFile(new File(["camera"], "camera.jpg", { type: "image/jpeg" }))}
      >
        Take photo
      </button>
      <button
        type="button"
        onClick={() => onFile(new File(["library"], "library.jpg", { type: "image/jpeg" }))}
      >
        Choose from Photos
      </button>
    </div>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AppShell } from "@/components/garden/shell";
import { JournalEntryProvider } from "@/components/garden/journal-entry";

const garden = {
  id: "garden-1",
  name: "Kitchen Garden",
  kind: "hydroponic",
  cover: "",
  place: "Kitchen",
  note: "",
};
const plant = {
  id: "plant-1",
  gardenId: garden.id,
  name: "Genovese Basil",
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "Genovese",
  knowledgeId: "basil",
  plantedDaysAgo: 12,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  slot: "Pod 2",
  backendGrowCycleId: "cycle-1",
  backendPositionId: "position-2",
};

function renderExperience(pathname = "/") {
  mocks.pathname = pathname;
  return render(
    <JournalEntryProvider>
      <AppShell>
        <main>Current page</main>
      </AppShell>
    </JournalEntryProvider>,
  );
}

function openRecord() {
  fireEvent.click(screen.getByRole("button", { name: "Record" }));
}

function chooseHomePlant() {
  fireEvent.change(screen.getByLabelText("Garden"), { target: { value: garden.id } });
  fireEvent.change(screen.getByLabelText("Plant / position"), { target: { value: plant.id } });
}

beforeEach(() => {
  mocks.store = {
    language: "en",
    profile: { name: "Juan", signedIn: true },
    hydration: "ready",
    gardens: [garden],
    plants: [plant],
    photos: [],
    addPhoto: vi.fn(() => "photo-local-1"),
    addEvent: vi.fn(async () => undefined),
  };
});

afterEach(() => cleanup());

describe("Journal Entry from real shell entry points", () => {
  it("opens from Home with garden and plant/position selection, and saves note-only moments", async () => {
    renderExperience("/");
    expect(screen.queryByRole("link", { name: /Care|Cuidado/ })).toBeNull();
    openRecord();
    chooseHomePlant();
    fireEvent.change(screen.getByPlaceholderText("What would you like to remember?"), {
      target: { value: "Looks beautiful today." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save moment" }));
    await waitFor(() => expect(mocks.store["addEvent"]).toHaveBeenCalledTimes(1));
    expect(mocks.store["addEvent"]).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: plant.id,
        gardenId: garden.id,
        type: "note",
        title: "Looks beautiful today.",
        detail: "Looks beautiful today.",
      }),
      expect.objectContaining({ waitForPersistence: true }),
    );
  });

  it("uses Garden Detail context without asking for the garden again", () => {
    renderExperience(`/gardens/${garden.id}`);
    openRecord();
    expect(screen.queryByLabelText("Garden")).toBeNull();
    expect(screen.getByLabelText("Plant / position")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain(garden.name);
  });

  it("opens directly from Plant Detail with its plant, garden and position already known", () => {
    renderExperience(`/plants/${plant.id}`);
    openRecord();
    expect(screen.queryByLabelText("Garden")).toBeNull();
    expect(screen.queryByLabelText("Plant / position")).toBeNull();
    expect(screen.getByText(plant.name)).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain(garden.name);
  });

  it("records a milestone-only moment as an explicit structured journal event", async () => {
    renderExperience(`/plants/${plant.id}`);
    openRecord();
    fireEvent.click(screen.getByRole("button", { name: "Flowering" }));
    fireEvent.click(screen.getByRole("button", { name: "Save moment" }));
    await waitFor(() => expect(mocks.store["addEvent"]).toHaveBeenCalledTimes(1));
    expect(mocks.store["addEvent"]).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: plant.id,
        type: "flowering",
        journalMilestone: "flowering",
        title: "Flowering",
        detail: "Flowering",
      }),
      expect.anything(),
    );
  });

  it("supports photo-only, photo plus note and photo plus milestone, with preview replacement/removal", async () => {
    renderExperience(`/plants/${plant.id}`);
    openRecord();
    fireEvent.click(screen.getAllByRole("button", { name: "Take photo" })[0]!);
    expect(await screen.findByAltText("camera.jpg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByAltText("camera.jpg")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Choose from Photos" })[0]!);
    expect(await screen.findByAltText("library.jpg")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("What would you like to remember?"), {
      target: { value: "A new leaf is opening." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fruiting" }));
    fireEvent.click(screen.getByRole("button", { name: "Save moment" }));
    await waitFor(() => expect(mocks.store["addEvent"]).toHaveBeenCalledTimes(1));
    expect(mocks.store["addPhoto"]).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: plant.id,
        src: expect.stringMatching(/^data:image\/jpeg;base64,/),
      }),
    );
    expect(mocks.store["addEvent"]).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: plant.id,
        type: "fruiting",
        journalMilestone: "fruiting",
        detail: "A new leaf is opening.",
        photoId: "photo-local-1",
      }),
      expect.objectContaining({
        photo: expect.objectContaining({ plantId: plant.id, id: "photo-local-1" }),
        waitForPersistence: true,
      }),
    );
  });

  it("renders new composer copy in Spanish", () => {
    mocks.store = { ...mocks.store, language: "es" };
    renderExperience(`/plants/${plant.id}`);
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(screen.getByRole("heading", { name: "Registrar un momento" })).toBeTruthy();
    expect(screen.getByText("Foto · opcional")).toBeTruthy();
    expect(screen.getByText("Nota · opcional")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar momento" })).toBeTruthy();
  });
});
