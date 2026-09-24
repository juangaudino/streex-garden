// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./garden-ai";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useGarden: vi.fn(), runDraftCheck: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to?: string } & Record<string, unknown>) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: mocks.useGarden }));
vi.mock("@/components/garden/shell", () => ({ PageHeader: () => <header>Garden AI</header> }));
vi.mock("@/components/garden/atoms", () => ({
  PlantThumb: () => null,
  ProvenanceTag: () => <span>Inferred</span>,
  ConfidenceBar: () => null,
}));
vi.mock("@/components/garden/photo-image", () => ({ PhotoImage: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock("@/lib/garden-backend", () => ({ runAiCheckDraft: mocks.runDraftCheck }));
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

  it("opens without a selected plant, shows one persistent AI Check module, and keeps Compare gated", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    mocks.useGarden.mockReturnValue({ language: "en", plants: [], gardens: [], photos: [], events: [], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    const { container } = render(<GardenAI />);

    expect(screen.getAllByRole("heading", { name: "AI Check" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Identify" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "AI Compare" }).closest('[aria-disabled="true"]')).toBeTruthy();
    expect(screen.getByText(/without plant-specific history or identity/i)).toBeTruthy();
    expect(container.querySelector("[data-testid='garden-ai-actions']" )).toBeNull();
  });

  it("runs the persistent module as photo-only and uses the newly chosen evidence photo", async () => {
    const proposal = {
      headline: "Young leaves are visible",
      summary: "The current photo shows a few young green leaves.",
      confidence: "medium",
      overall_visible_state: "appears_stable",
      possible_harvest_readiness: "not_assessed",
      possible_incident: "no_visible_signs",
      observations: ["Several green leaves are visible."],
      interpretations: ["The plant appears to be developing."],
      uncertainty: ["The plant identity is not established."],
      development_recommendations: [],
    };
    mocks.runDraftCheck.mockResolvedValue({ proposal, requestId: "draft-photo-only" });
    mocks.useGarden.mockReturnValue({ language: "en", plants: [], gardens: [], photos: [], events: [], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    render(<GardenAI />);

    const camera = document.querySelector<HTMLInputElement>('input[capture="environment"]')!;
    fireEvent.change(camera, { target: { files: [new File(["current"], "current.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("New photo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Analyse this photo" }));
    await waitFor(() => expect(mocks.runDraftCheck).toHaveBeenCalledWith(null, expect.stringContaining("data:image/jpeg;base64,"), "en"));
    expect(await screen.findByText("Young leaves are visible")).toBeTruthy();
  });

  it("adds only the selected plant cycle to the same AI Check module and clears it without hiding the module", async () => {
    const plant = {
      id: "plant-mint",
      gardenId: "garden-1",
      name: "Common Mint",
      species: "Mentha spicata",
      scientific: "Mentha spicata",
      variety: "",
      knowledgeId: "common-mint",
      plantedDaysAgo: 30,
      status: "steady",
      statusNote: "",
      heroPhotoId: "hero-photo",
      identityConfirmed: true,
      backendGrowCycleId: "cycle-mint",
      slot: "H2 · Pod 1",
      cycleClosed: false,
    };
    mocks.runDraftCheck.mockResolvedValue({ proposal: { headline: "New leaf visible", summary: "A fresh leaf is visible.", confidence: "medium", overall_visible_state: "appears_stable", possible_harvest_readiness: "not_assessed", possible_incident: "no_visible_signs", observations: ["One leaf is visible."], interpretations: [], uncertainty: [], development_recommendations: [] }, requestId: "cycle-check" });
    mocks.useGarden.mockReturnValue({ language: "en", plants: [plant], gardens: [{ id: "garden-1", name: "Garden One", place: "Kitchen" }], photos: [{ id: "hero-photo", plantId: plant.id, url: "https://example.test/hero.jpg" }], events: [{ id: "event-1", plantId: plant.id }], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    render(<GardenAI />);

    expect(screen.getByRole("heading", { name: "AI Check" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Common Mint/ }));
    expect(await screen.findByAltText("Common Mint")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "AI Compare" }).closest("a")?.getAttribute("href")).toContain("/plants/$plantId/compare");

    const library = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1]!;
    fireEvent.change(library, { target: { files: [new File(["check"], "check.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("New photo")).toBeTruthy();
    expect(screen.getByAltText("Common Mint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Analyse this photo" }));
    await waitFor(() => expect(mocks.runDraftCheck).toHaveBeenCalledWith("cycle-mint", expect.stringContaining("data:image/jpeg;base64,"), "en"));
    expect(await screen.findByText("New leaf visible")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "AI Check" })).toBeTruthy();
    expect(screen.queryByAltText("Common Mint")).toBeNull();
    expect(screen.getByText(/without plant-specific history or identity/i)).toBeTruthy();
  });

  it("shows the photo affordance on a mobile viewport and carries its selected image into global Ask Garden", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    mocks.useGarden.mockReturnValue({ language: "en", plants: [], gardens: [], photos: [], events: [], tasks: [] });
    const GardenAI = Route.options.component as React.ComponentType;
    render(<GardenAI />);

    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Take photo" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Choose from Photo Library" })).toBeTruthy();
    const library = screen.getByRole("dialog").querySelectorAll<HTMLInputElement>('input[type="file"]')[1]!;
    fireEvent.change(library, { target: { files: [new File(["garden"], "garden.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByAltText("Attached photo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Take photo" })).toBeTruthy();
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
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Tomar foto" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Elegir de Fotos" })).toBeTruthy();
  });
});
