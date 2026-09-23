// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route } from "./ask";

const mocks = vi.hoisted(() => ({ askGardenAi: vi.fn(), useGarden: vi.fn(), prompt: undefined as string | undefined, locationState: undefined as unknown }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, options, useSearch: () => ({ prompt: mocks.prompt }) }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location: { state: mocks.locationState } }),
}));
vi.mock("@/lib/garden-store", () => ({ useGarden: mocks.useGarden }));
vi.mock("@/lib/garden-backend", () => ({ askGardenAi: mocks.askGardenAi }));
vi.mock("@/components/garden/photo-source-picker", () => ({
  PhotoSourcePicker: ({ onFile }: { onFile: (file: File) => void }) => (
    <div>
      <button type="button" onClick={() => onFile(new File(["wide"], "wide.png", { type: "image/png" }))}>Choose from Photo Library</button>
    </div>
  ),
}));
vi.mock("@/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationScrollButton: () => null,
}));
vi.mock("@/components/ai-elements/message", () => ({
  Message: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/garden/atoms", () => ({ ProvenanceTag: () => <span>Recorded</span> }));
vi.mock("@/components/ai-elements/shimmer", () => ({ Shimmer: () => <span>Thinking</span> }));
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({ open: false, onOpenChange: () => undefined });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({ children }: { children: React.ReactElement }) => {
      const context = React.useContext(DialogContext);
      return React.cloneElement(children, { onClick: () => context.onOpenChange(true) });
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => React.useContext(DialogContext).open ? <div role="dialog">{children}</div> : null,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  };
});

describe("Garden-wide Ask Garden image turns", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.prompt = undefined;
    mocks.locationState = undefined;
  });

  it("sends a new image in-turn, preserves the thread, and never renders raw source IDs", async () => {
    mocks.useGarden.mockReturnValue({ language: "en", plants: [{ id: "plant-1" }], gardens: [], events: [], photos: [], tasks: [] });
    mocks.askGardenAi.mockResolvedValue({
      answer_type: "answer",
      answer: "The wider image includes the reservoir.",
      confirmed_facts: [{ source: { kind: "event", id: "164bf4c9-aaaa-bbbb-cccc-123456789012" }, claim: "Water change was recorded." }],
      suggested_next_actions: [],
    });
    const GardenWideAsk = Route.options.component as React.ComponentType;
    render(<GardenWideAsk />);

    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose from Photo Library" }));
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Ask about your garden…"), { target: { value: "Does this show the reservoir?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about your garden…").closest("form")!);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(1));
    expect(mocks.askGardenAi.mock.calls[0]![2]).toMatchObject({ messageImageDataUrl: expect.stringContaining("data:image/png;base64,") });
    expect(screen.getByText("Water change was recorded.")).toBeTruthy();
    expect(screen.queryByText(/164bf4c9|event ·/i)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Ask about your garden…"), { target: { value: "Could you compare with the last photo?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about your garden…").closest("form")!);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(2));
    expect(mocks.askGardenAi.mock.calls[1]![1][0].answer).toContain("The user attached a photo in that turn.");
  });

  it("receives the image attached on the real Garden AI global entry point as the first Ask Garden turn", async () => {
    mocks.useGarden.mockReturnValue({ language: "en", plants: [], gardens: [], events: [], photos: [], tasks: [] });
    mocks.prompt = "What does this show?";
    mocks.locationState = { gardenConversationImage: "data:image/jpeg;base64,Z2FyZGVu" };
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "The garden is visible.", confirmed_facts: [], suggested_next_actions: [] });
    const GardenWideAsk = Route.options.component as React.ComponentType;
    render(<GardenWideAsk />);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalledTimes(1));
    expect(mocks.askGardenAi.mock.calls[0]![0]).toBe("What does this show?");
    expect(mocks.askGardenAi.mock.calls[0]![2]).toMatchObject({ messageImageDataUrl: "data:image/jpeg;base64,Z2FyZGVu" });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
  });
});
