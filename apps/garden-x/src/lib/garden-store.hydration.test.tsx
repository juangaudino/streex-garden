// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  changes: vi.fn(),
  summaries: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
}));
vi.mock("./supabase", () => ({
  hasSupabaseConfiguration: () => true,
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1", email: "test@example.invalid" } } },
        error: null,
      }),
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  }),
}));
vi.mock("./garden-backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./garden-backend")>()),
  loadGardenState: mocks.load,
  loadMeaningfulChangeResults: mocks.changes,
  loadGardenSummaryResults: mocks.summaries,
  clearPersistentPhotoCache: vi.fn(),
  setPersistentPhotoCacheUserId: vi.fn(),
}));
import { GardenProvider, useGarden } from "./garden-store";
function Probe() {
  const state = useGarden();
  return (
    <div>
      {state.hydration}|{state.meaningfulChanges.length}|{state.gardenSummaries.length}
    </div>
  );
}
const empty = {
  gardens: [],
  plants: [],
  historicalPlants: [],
  photos: [],
  events: [],
  tasks: [],
  films: [],
};

describe("Garden independent hydration", () => {
  beforeEach(() => {
    mocks.load.mockReset();
    mocks.changes.mockReset();
    mocks.summaries.mockReset();
    mocks.listener = null;
    mocks.load.mockResolvedValue({ state: empty });
  });
  afterEach(() => cleanup());
  it("shows the garden even if secondary analysis is slow or unavailable", async () => {
    mocks.changes.mockRejectedValue(new Error("offline"));
    mocks.summaries.mockImplementation(() => new Promise(() => {}));
    render(
      <GardenProvider>
        <Probe />
      </GardenProvider>,
    );
    await waitFor(() => expect(screen.getByText("ready|0|0")).toBeTruthy());
  });
  it("shows available changes without waiting for a stalled summary", async () => {
    mocks.changes.mockResolvedValue([{ id: "change" }]);
    mocks.summaries.mockImplementation(() => new Promise(() => {}));
    render(<GardenProvider><Probe /></GardenProvider>);
    await waitFor(() => expect(screen.getByText("ready|1|0")).toBeTruthy());
  });
  it("shows an available summary without waiting for stalled changes", async () => {
    mocks.changes.mockImplementation(() => new Promise(() => {}));
    mocks.summaries.mockResolvedValue([{ id: "summary" }]);
    render(<GardenProvider><Probe /></GardenProvider>);
    await waitFor(() => expect(screen.getByText("ready|0|1")).toBeTruthy());
  });
  it("does not restore late private analysis after sign-out", async () => {
    let resolve!: (value: unknown[]) => void;
    mocks.changes.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    mocks.summaries.mockResolvedValue([]);
    render(
      <GardenProvider>
        <Probe />
      </GardenProvider>,
    );
    await waitFor(() => expect(screen.getByText("ready|0|0")).toBeTruthy());
    act(() => mocks.listener?.("SIGNED_OUT", null));
    await act(async () => {
      resolve([{ id: "private" }]);
      await Promise.resolve();
    });
    expect(screen.getByText("ready|0|0")).toBeTruthy();
  });
});
