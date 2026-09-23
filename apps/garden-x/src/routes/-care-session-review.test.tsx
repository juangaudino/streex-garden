// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { PlantReview } from "./care";
import type { Plant } from "@/lib/garden-data";

const mocks = vi.hoisted(() => ({
  runAiCheckDraft: vi.fn(),
  askGardenAi: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => ({}), useNavigate: () => vi.fn() }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/lib/garden-backend", () => ({
  runAiCheckDraft: mocks.runAiCheckDraft,
  askGardenAi: mocks.askGardenAi,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ asChild, children, ...props }: { asChild?: boolean; children: ReactNode } & Record<string, unknown>) =>
    asChild ? <span>{children}</span> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/garden/photo-source-picker", () => ({
  PhotoSourcePicker: ({ onFile }: { onFile: (file: File) => void }) => (
    <>
      <input aria-label="Take photo" type="file" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onFile(file); }} />
      <input aria-label="Choose photo" type="file" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onFile(file); }} />
    </>
  ),
}));

const plant: Plant = {
  id: "plant-mint",
  gardenId: "garden-one",
  name: "Common Mint",
  species: "Mentha",
  scientific: "Mentha spicata",
  variety: "",
  knowledgeId: "common-mint",
  plantedDaysAgo: 30,
  status: "steady",
  statusNote: "",
  heroPhotoId: "existing-photo",
  identityConfirmed: true,
  backendGrowCycleId: "cycle-mint",
};

function ReviewHarness({ onRecord = vi.fn(), onNext = vi.fn(), onSkip = vi.fn() } = {}) {
  const [workingPhoto, setWorkingPhoto] = useState<string>();
  return (
    <PlantReview
      plant={plant}
      language="en"
      gardenName="Garden One"
      lastReview={undefined}
      photoSrc="persisted-plant-photo.jpg"
      workingPhoto={workingPhoto}
      onWorkingPhoto={setWorkingPhoto}
      recentEvent={undefined}
      contextEventCount={3}
      sessionItem={2}
      sessionTotal={8}
      attention={undefined}
      onRecord={onRecord}
      onNext={onNext}
      onSkip={onSkip}
      recordedForReview={false}
      careReturnSearch={{ careQueue: "plant-mint", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 }}
    />
  );
}

describe("Care Session plant review", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps Ask Garden enabled and AI Check disabled until a temporary photo is selected", async () => {
    render(<ReviewHarness />);

    expect(screen.getByRole("button", { name: "AI Check" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "Ask Garden" })).toBeTruthy();

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const file = new File(["photo"], "review.jpg", { type: "image/jpeg" });
    fireEvent.change(inputs[1]!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("button", { name: "AI Check" }).hasAttribute("disabled")).toBe(false));
    const hero = screen.getByAltText("Common Mint, Mentha") as HTMLImageElement;
    expect(hero.src).toContain("data:image/jpeg;base64,");
    expect(mocks.runAiCheckDraft).not.toHaveBeenCalled();
  });

  it("runs the current cycle check inline and gives Ask Garden the photo-derived result context", async () => {
    mocks.runAiCheckDraft.mockResolvedValue({ proposal: {
      headline: "New leaves are visible",
      summary: "A current visual check.",
      confidence: "medium",
      observations: ["Several new leaves are visible."],
      interpretations: ["Growth may be progressing."],
      uncertainty: ["The framing differs from older photos."],
      development_recommendations: [],
    } });
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "The check notes new leaves.", confirmed_facts: [], suggested_next_actions: [] });
    const onRecord = vi.fn();
    const onNext = vi.fn();
    const onSkip = vi.fn();
    render(<ReviewHarness onRecord={onRecord} onNext={onNext} onSkip={onSkip} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[1]!, { target: { files: [new File(["photo"], "review.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect((screen.getByRole("button", { name: "AI Check" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "AI Check" }));

    expect(await screen.findByRole("heading", { name: "New leaves are visible" })).toBeTruthy();
    expect(mocks.runAiCheckDraft).toHaveBeenCalledWith("cycle-mint", expect.stringContaining("data:image/jpeg;base64,"), "en");
    expect(screen.getByText("Visual observation")).toBeTruthy();
    expect(screen.getAllByText("Inference").length).toBeGreaterThan(0);
    expect(onRecord).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Ask about this…"), { target: { value: "What should I watch for?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about this…").closest("form")!);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalled());
    const context = mocks.askGardenAi.mock.calls[0]![1][0].answer as string;
    expect(context).toContain("plant-mint");
    expect(context).toContain("cycle-mint");
    expect(context).toContain("Care Session item: 2 of 8");
    expect(context).toContain("Garden One");
    expect(context).toContain("used for the current AI Check");
    expect(context).toContain("Several new leaves are visible.");
  });
});
