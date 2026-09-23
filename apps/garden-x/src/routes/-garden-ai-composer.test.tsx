// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./garden-ai";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useGarden: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: mocks.useGarden }));
vi.mock("@/components/garden/shell", () => ({ PageHeader: () => <header>Garden AI</header> }));
vi.mock("@/components/garden/atoms", () => ({
  PlantThumb: () => null,
  ProvenanceTag: () => <span>Inferred</span>,
  ConfidenceBar: () => null,
}));
vi.mock("@/components/garden/photo-image", () => ({ PhotoImage: () => null }));
vi.mock("@/lib/garden-backend", () => ({ runAiCheckDraft: vi.fn() }));
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const Context = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({ open: false, onOpenChange: () => undefined });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => <Context.Provider value={{ open, onOpenChange }}>{children}</Context.Provider>,
    DialogTrigger: ({ children }: { children: React.ReactElement }) => {
      const context = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => context.onOpenChange(true) });
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => React.useContext(Context).open ? <div role="dialog">{children}</div> : null,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  };
});

describe("Garden AI real composer entry point", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the photo affordance on a mobile viewport and carries its selected image into global Ask Garden", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    mocks.useGarden.mockReturnValue({ language: "en", plants: [], gardens: [], photos: [], events: [], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    render(<GardenAI />);

    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose from Photo Library" })).toBeTruthy();
    const library = screen.getByRole("dialog").querySelectorAll<HTMLInputElement>('input[type="file"]')[1]!;
    fireEvent.change(library, { target: { files: [new File(["garden"], "garden.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByAltText("Attached photo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    const camera = screen.getByRole("dialog").querySelector<HTMLInputElement>('input[capture="environment"]')!;
    fireEvent.change(camera, { target: { files: [new File(["camera"], "camera.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Ask about your garden…"), { target: { value: "What does this show?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about your garden…").closest("form")!);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({
      to: "/ask",
      search: { prompt: "What does this show?" },
      state: { gardenConversationImage: expect.stringContaining("data:image/jpeg;base64,") },
    }));
  });

  it("localizes the real attachment trigger and device choices in Spanish", async () => {
    mocks.useGarden.mockReturnValue({ language: "es", plants: [], gardens: [], photos: [], events: [], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    render(<GardenAI />);
    fireEvent.click(screen.getByRole("button", { name: "Adjuntar una foto" }));
    expect(screen.getByRole("button", { name: "Tomar foto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Elegir de Fotos" })).toBeTruthy();
  });
});
