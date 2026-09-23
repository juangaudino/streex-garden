// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditGarden } from "./edit-garden";

const mocks = vi.hoisted(() => ({
  updateGarden: vi.fn(),
  setGardenCoverPhoto: vi.fn(),
  uploadGardenCoverPhoto: vi.fn(),
  loadGardenCoverPhotos: vi.fn(),
  updatePlant: vi.fn(),
  deleteGarden: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/garden-store", () => ({
  useGarden: () => ({
    updateGarden: mocks.updateGarden,
    updatePlant: mocks.updatePlant,
    deleteGarden: mocks.deleteGarden,
    language: "en",
    loadGardenCoverPhotos: mocks.loadGardenCoverPhotos,
    setGardenCoverPhoto: mocks.setGardenCoverPhoto,
    uploadGardenCoverPhoto: mocks.uploadGardenCoverPhoto,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError, warning: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) => <button type={type} onClick={onClick} disabled={disabled}>{children}</button>,
}));
vi.mock("@/components/garden/photo-image", () => ({ PhotoImage: ({ alt }: { alt?: string }) => <img alt={alt || "Existing garden cover"} /> }));
vi.mock("@/components/garden/custom-system-layout-editor", () => ({ CustomSystemLayoutEditor: () => <div>Saved map geometry</div> }));
vi.mock("@/components/garden/photo-source-picker", () => ({ PhotoSourcePicker: () => <div>Photo picker</div> }));

const garden = {
  id: "garden-h5",
  name: "Uruq 12",
  kind: "hydroponic" as const,
  cover: "",
  coverPhotoId: "photo-cover-existing",
  place: "Counter",
  note: "Custom System Layout",
  machine: { name: "Uruq 12", pods: 12 },
  backendSystemInstanceId: "system-instance-h5",
  systemDefinitionKey: "uruq_12_v1",
  backendPositions: Array.from({ length: 12 }, (_, index) => ({ id: `position-${index + 1}`, number: index + 1 })),
  systemLayoutLevels: [{ levelNumber: 1, rows: 3, columns: 7, activeCells: Array.from({ length: 12 }, (_, index) => ({ row: 1, column: index + 1 })) }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("Edit Garden canonical save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGardenCoverPhotos.mockResolvedValue([{ id: "photo-cover-existing", plantId: "plant-1", src: "cover.jpg", daysAgo: 2, capturedAt: null, capturedAtPrecision: "unknown", caption: "", metrics: { heightCm: null, leafCount: null, greenness: 0, density: null } }]);
    mocks.updateGarden.mockResolvedValue(undefined);
    mocks.setGardenCoverPhoto.mockResolvedValue(undefined);
    mocks.uploadGardenCoverPhoto.mockResolvedValue("new-cover-id");
  });
  afterEach(cleanup);

  it("saves garden metadata and system instance name separately, waits for canonical persistence, and preserves capacity, cover, and map", async () => {
    const save = deferred<void>();
    mocks.updateGarden.mockReturnValue(save.promise);
    render(<EditGarden garden={garden} plants={[]} photos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit garden/ }));
    fireEvent.change(screen.getByLabelText("Garden name"), { target: { value: "H5 Greens" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Kitchen" } });
    fireEvent.change(screen.getByLabelText("Growing setup"), { target: { value: "Dedicado a Greens" } });
    fireEvent.change(screen.getByLabelText("System"), { target: { value: "Uruq" } });
    fireEvent.click(screen.getByRole("button", { name: "Save garden" }));

    expect(mocks.updateGarden).toHaveBeenCalledWith("garden-h5", {
      name: "H5 Greens",
      place: "Kitchen",
      note: "Dedicado a Greens",
      machine: { name: "Uruq", pods: 12 },
    });
    expect(screen.getByLabelText("Garden name")).toBeTruthy();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.setGardenCoverPhoto).not.toHaveBeenCalled();
    expect(mocks.uploadGardenCoverPhoto).not.toHaveBeenCalled();
    expect(screen.getByText("Saved map geometry")).toBeTruthy();

    save.resolve(undefined);
    await waitFor(() => expect(screen.queryByLabelText("Garden name")).toBeNull());
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(garden.systemDefinitionKey).toBe("uruq_12_v1");
    expect(garden.backendPositions).toHaveLength(12);
    expect(garden.coverPhotoId).toBe("photo-cover-existing");
  });

  it("does not close or report success when the required canonical write fails", async () => {
    mocks.updateGarden.mockRejectedValue(new Error("system instance write denied"));
    render(<EditGarden garden={garden} plants={[]} photos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit garden/ }));
    fireEvent.change(screen.getByLabelText("Garden name"), { target: { value: "H5 Greens" } });
    fireEvent.click(screen.getByRole("button", { name: "Save garden" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(screen.getByLabelText("Garden name")).toBeTruthy();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.setGardenCoverPhoto).not.toHaveBeenCalled();
  });

  it("does not report success when the separate cover persistence step fails", async () => {
    mocks.loadGardenCoverPhotos.mockResolvedValueOnce([
      { id: "photo-cover-new", plantId: "plant-1", src: "new-cover.jpg", daysAgo: 1, capturedAt: null, capturedAtPrecision: "unknown", caption: "Choose this garden cover", metrics: { heightCm: null, leafCount: null, greenness: 0, density: null } },
    ]);
    mocks.setGardenCoverPhoto.mockRejectedValueOnce(new Error("cover update denied"));
    render(<EditGarden garden={garden} plants={[]} photos={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit garden/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose this garden cover" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Choose this garden cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save garden" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(screen.getByLabelText("Garden name")).toBeTruthy();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.updateGarden).toHaveBeenCalledTimes(1);
    expect(mocks.setGardenCoverPhoto).toHaveBeenCalledWith("garden-h5", "photo-cover-new");
  });
});
