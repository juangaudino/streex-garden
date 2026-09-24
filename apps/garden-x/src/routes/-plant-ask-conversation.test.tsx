// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCareInspectionState, careReviewPhotoKey } from "@/lib/care-session";
import type { Plant } from "@/lib/garden-data";
import { Route } from "./plants.$plantId.ask";

const plant: Plant = {
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
  heroPhotoId: null,
  identityConfirmed: true,
  backendGrowCycleId: "cycle-mint",
};

const mocks = vi.hoisted(() => ({
  askGarden: vi.fn(),
  askGardenAi: vi.fn(),
  useGarden: vi.fn(),
  params: { plantId: "plant-mint" },
  search: { from: undefined as string | undefined, prompt: undefined as string | undefined, careQueue: "plant-mint", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 },
  locationState: undefined as unknown,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options, useParams: () => mocks.params, useSearch: () => mocks.search }),
  Link: ({ children, to, search, ...props }: { children: React.ReactNode; to: string; search?: unknown } & Record<string, unknown>) => <a data-to={to} data-search={JSON.stringify(search ?? {})} {...props}>{children}</a>,
  notFound: () => new Error("Not found"),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location: { state: mocks.locationState } }),
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: mocks.useGarden }));
vi.mock("@/lib/garden-logic", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garden-logic")>();
  return { ...actual, askGarden: mocks.askGarden };
});
vi.mock("@/lib/garden-backend", () => ({ askGardenAi: mocks.askGardenAi }));
vi.mock("@/components/garden/atoms", () => ({ ProvenanceTag: () => <span>Recorded</span> }));
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

function buildStore(language = "en", withCare = false) {
  const inspection = { ...createCareInspectionState(careReviewPhotoKey(plant.id, plant.backendGrowCycleId)), workingPhoto: "data:image/jpeg;base64,Y2FyZS1yZXZpZXc=", checkProposal: {
    headline: "Outer leaves are visible",
    summary: "The review photo shows developed outer foliage.",
    confidence: "medium" as const,
    observations: ["Several outer leaves are visible."],
    interpretations: ["Selective harvest may be worth evaluating."],
    uncertainty: ["The full plant is not in frame."],
  } };
  return {
    language,
    plants: [plant],
    gardens: [{ id: "garden-1", name: "Garden One" }],
    events: [],
    photos: [],
    tasks: [],
    careInspection: withCare ? inspection : null,
  };
}

describe("plant-scoped Ask Garden real route composer", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.search = { from: undefined, prompt: undefined, careQueue: "plant-mint", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 };
    mocks.locationState = undefined;
  });

  it("keeps a deterministic recorded nutrient lookup on the local plant-record path", async () => {
    mocks.useGarden.mockReturnValue(buildStore());
    mocks.askGarden.mockReturnValue({ question: "When did I last fertilize this plant?", grounded: ["No nutrient event is recorded for Common Mint."], evidence: [], inference: "" });
    const PlantAsk = Route.options.component as React.ComponentType;
    render(<PlantAsk />);
    fireEvent.change(screen.getByPlaceholderText("Ask about Common Mint…"), { target: { value: "When did I last fertilize this plant?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about Common Mint…").closest("form")!);
    await waitFor(() => expect(mocks.askGarden).toHaveBeenCalledTimes(1));
    expect(mocks.askGardenAi).not.toHaveBeenCalled();
    expect(await screen.findByText("No nutrient event is recorded for Common Mint.")).toBeTruthy();
  });

  it("routes open-ended contextual questions to Garden AI instead of presenting the local context fallback", async () => {
    mocks.useGarden.mockReturnValue(buildStore());
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "Kratky reservoirs are usually topped up or changed based on the solution condition and container practice; Garden X has no water-change interval recorded for this plant.", confirmed_facts: [], suggested_next_actions: [] });
    const PlantAsk = Route.options.component as React.ComponentType;
    render(<PlantAsk />);
    const input = screen.getByPlaceholderText("Ask about Common Mint…");
    fireEvent.change(input, { target: { value: "How often should I change the water in Kratky?" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(1));
    expect(mocks.askGarden).not.toHaveBeenCalled();
    expect(mocks.askGardenAi.mock.calls[0]![0]).toBe("How often should I change the water in Kratky?");
    expect(mocks.askGardenAi.mock.calls[0]![1][0].answer).toContain("plant-mint");
    expect(await screen.findByText(/Kratky reservoirs are usually/)).toBeTruthy();
    expect(screen.queryByText(/I answer from what is recorded here/i)).toBeNull();
  });

  it("asks which plant 'the other' means instead of inventing a comparison", async () => {
    mocks.useGarden.mockReturnValue(buildStore("en"));
    const PlantAsk = Route.options.component as React.ComponentType;
    render(<PlantAsk />);
    const input = screen.getByPlaceholderText("Ask about Common Mint…");
    fireEvent.change(input, { target: { value: "Why does it grow faster than the other?" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText(/Which other plant would you like to compare it with/)).toBeTruthy();
    expect(mocks.askGardenAi).not.toHaveBeenCalled();
    expect(mocks.askGarden).not.toHaveBeenCalled();
  });

  it("attaches a new image from Care without merging it into the review photo, preserves plant/cycle context and keeps the Care return state", async () => {
    mocks.search = { from: "care", prompt: undefined, careQueue: "plant-mint", careIndex: 2, careRecorded: false, careReviewed: 1, careObservations: 0, careActions: 0, careFollowups: 0 };
    const store = buildStore("es", true);
    mocks.useGarden.mockReturnValue(store);
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "La imagen nueva muestra el depósito lateral.", confirmed_facts: [{ source: { kind: "event", id: "164bf4c9-aaaa-bbbb-cccc-123456789012" }, claim: "Se registró el cambio de agua." }], suggested_next_actions: [] });
    const PlantAsk = Route.options.component as React.ComponentType;
    render(<PlantAsk />);

    expect(screen.getByRole("button", { name: "Adjuntar una foto" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adjuntar una foto" }));
    expect(screen.getByRole("button", { name: "Tomar foto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Elegir de Fotos" })).toBeTruthy();
    const library = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1]!;
    fireEvent.change(library, { target: { files: [new File(["new"], "detail.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("Foto adjunta")).toBeTruthy();
    expect(screen.queryByText(/164bf4c9|event ·/i)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Preguntar sobre Common Mint…"), { target: { value: "¿Puedes ver el depósito?" } });
    fireEvent.submit(screen.getByPlaceholderText("Preguntar sobre Common Mint…").closest("form")!);

    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(1));
    const [question, conversation, attachments] = mocks.askGardenAi.mock.calls[0]!;
    expect(question).toBe("¿Puedes ver el depósito?");
    expect(conversation[0].answer).toContain("plant-mint");
    expect(conversation[0].answer).toContain("cycle-mint");
    expect(conversation[0].answer).toContain("Outer leaves are visible");
    expect(attachments).toMatchObject({
      photoDataUrl: "data:image/jpeg;base64,Y2FyZS1yZXZpZXc=",
      context: expect.stringContaining("Temporary Care Session review context"),
      messageImageDataUrl: expect.stringContaining("data:image/jpeg;base64,"),
    });
    expect(attachments.messageImageDataUrl).not.toBe(attachments.photoDataUrl);
    expect(await screen.findByAltText("Foto adjunta")).toBeTruthy();

    const back = document.querySelector<HTMLAnchorElement>('a[data-to="/care"]')!;
    expect(back.getAttribute("data-to")).toBe("/care");
    expect(back.getAttribute("data-search")).toContain('"careIndex":2');
    expect(store.careInspection?.key).toBe(careReviewPhotoKey(plant.id, plant.backendGrowCycleId));
    expect(store.careInspection?.workingPhoto).toBe("data:image/jpeg;base64,Y2FyZS1yZXZpZXc=");
  });

  it("consumes a Garden AI image passed through navigation state on the plant-scoped route", async () => {
    mocks.search = { from: "garden-ai", prompt: "Look at this leaf", careQueue: "", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 };
    mocks.locationState = { gardenConversationImage: "data:image/png;base64,bGVhZg==" };
    mocks.useGarden.mockReturnValue(buildStore());
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "A leaf is visible.", confirmed_facts: [], suggested_next_actions: [] });
    const PlantAsk = Route.options.component as React.ComponentType;
    render(<PlantAsk />);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(1));
    expect(mocks.askGardenAi.mock.calls[0]![2]).toMatchObject({ messageImageDataUrl: "data:image/png;base64,bGVhZg==" });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
  });

  it("keeps long plant-scoped messages and the attachment composer inside a narrow mobile layout", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    mocks.useGarden.mockReturnValue(buildStore());
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "Long evidence ".concat("unbrokenword".repeat(24)), confirmed_facts: [], suggested_next_actions: [] });
    const PlantAsk = Route.options.component as React.ComponentType;
    const { container } = render(<PlantAsk />);
    expect((container.firstElementChild as HTMLElement).className).toContain("min-w-0");
    const form = container.querySelector("form")!;
    expect(form.className).toContain("min-w-0");
    expect(form.querySelector("input")?.className).toContain("max-w-full");
    fireEvent.change(screen.getByPlaceholderText("Ask about Common Mint…"), { target: { value: "What changed?" } });
    fireEvent.submit(form);
    expect(await screen.findByText(/unbrokenword/)).toBeTruthy();
    const messageCard = container.querySelector(".surface") as HTMLElement;
    expect(messageCard.className).toContain("min-w-0");
    expect(messageCard.className).toContain("overflow-wrap:anywhere");
  });
});
