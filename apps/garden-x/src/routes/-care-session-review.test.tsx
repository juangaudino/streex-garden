// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { PlantReview } from "./care";
import type { Photo, Plant } from "@/lib/garden-data";
import { createCareInspectionState, careReviewPhotoKey } from "@/lib/care-session";
import type { CareInspectionState } from "@/lib/care-session";
import { latestPlantPhoto } from "@/lib/garden-logic";

const mocks = vi.hoisted(() => ({
  runAiCheckDraft: vi.fn(),
  askGardenAi: vi.fn(),
  resolvePhotoUrl: vi.fn(),
  persistPhotoRendition: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => ({}), useNavigate: () => vi.fn() }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/lib/garden-backend", () => ({
  runAiCheckDraft: mocks.runAiCheckDraft,
  askGardenAi: mocks.askGardenAi,
  resolvePhotoUrl: mocks.resolvePhotoUrl,
  persistPhotoRendition: mocks.persistPhotoRendition,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ asChild, children, ...props }: { asChild?: boolean; children: ReactNode } & Record<string, unknown>) =>
    asChild ? <span>{children}</span> : <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({ open: false, onOpenChange: () => undefined });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({ children }: { children: React.ReactElement }) => {
      const context = React.useContext(DialogContext);
      return React.cloneElement(children, { onClick: () => context.onOpenChange(true) });
    },
    DialogContent: ({ children }: { children: ReactNode }) => React.useContext(DialogContext).open ? <div role="dialog">{children}</div> : null,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  };
});

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

function canonicalPhoto(plantId = plant.id, id = "existing-photo"): Photo {
  return {
    id,
    plantId,
    mediaScope: "cycle_evidence",
    src: "",
    daysAgo: 2,
    caption: "",
    metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
    backendStoragePath: `owner/${id}/original.jpg`,
    backendGrowCycleId: plant.backendGrowCycleId,
    capturedAt: "2026-09-21T12:00:00Z",
    provenance: "recorded",
  };
}

function ReviewHarness({ onRecord = vi.fn(), onNext = vi.fn(), onSkip = vi.fn(), existingPhotos = [canonicalPhoto()] as Photo[], language = "en" }: { onRecord?: () => void; onNext?: () => void; onSkip?: () => void; existingPhotos?: Photo[]; language?: "en" | "es" } = {}) {
  const [inspection, setInspection] = useState<CareInspectionState>(() => createCareInspectionState(careReviewPhotoKey(plant.id, plant.backendGrowCycleId)));
  const [mounted, setMounted] = useState(true);
  return (
    <>
    <button type="button" onClick={() => setMounted((value) => !value)}>Toggle Care item</button>
    <output data-testid="inspection-state">{JSON.stringify(inspection)}</output>
    {mounted ? <PlantReview
      plant={plant}
      language={language}
      gardenName="Garden One"
      lastReview={undefined}
      canonicalPhoto={latestPlantPhoto(existingPhotos, plant.id)}
      workingPhoto={inspection.workingPhoto}
      inspection={inspection}
      onInspectionPatch={(patch, token) => setInspection((current) => token && current.requestGuardId !== token ? current : { ...current, ...patch })}
      recentEvent={undefined}
      contextEventCount={3}
      recentHistory={["Water change · 2026-09-15"]}
      sessionItem={2}
      sessionTotal={8}
      attention={undefined}
      onRecord={onRecord}
      onNext={onNext}
      onSkip={onSkip}
      recordedForReview={false}
      careReturnSearch={{ careQueue: "plant-mint", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 }}
    /> : null}
    </>
  );
}

function MultiPlantPhotoHarness() {
  const secondPlant: Plant = { ...plant, id: "plant-romaine", name: "Red Romaine Lettuce", species: "Lactuca", backendGrowCycleId: "cycle-romaine" };
  const [currentPlant, setCurrentPlant] = useState(plant);
  const photos = [canonicalPhoto(plant.id, "mint-photo"), canonicalPhoto(secondPlant.id, "romaine-photo")];
  const inspection = createCareInspectionState(careReviewPhotoKey(currentPlant.id, currentPlant.backendGrowCycleId));
  return (
    <>
      <button type="button" onClick={() => setCurrentPlant((current) => current.id === plant.id ? secondPlant : plant)}>Advance plant</button>
      <PlantReview
        key={`${currentPlant.id}:${currentPlant.backendGrowCycleId}`}
        plant={currentPlant}
        language="en"
        gardenName="Garden One"
        lastReview={undefined}
        canonicalPhoto={latestPlantPhoto(photos, currentPlant.id)}
        workingPhoto={currentPlant.id === plant.id ? "data:image/jpeg;base64,bWludC1waG90bw==" : undefined}
        inspection={inspection}
        onInspectionPatch={() => undefined}
        recentEvent={undefined}
        contextEventCount={1}
        recentHistory={[]}
        sessionItem={1}
        sessionTotal={2}
        onRecord={() => undefined}
        onNext={() => undefined}
        onSkip={() => undefined}
        recordedForReview={false}
        careReturnSearch={{ careQueue: "plant-mint,plant-romaine", careIndex: 0, careRecorded: false, careReviewed: 0, careObservations: 0, careActions: 0, careFollowups: 0 }}
      />
    </>
  );
}

describe("Care Session plant review", () => {
  beforeEach(() => {
    mocks.resolvePhotoUrl.mockImplementation(async (photo: Pick<Photo, "backendStoragePath">) => `https://signed.example/${photo.backendStoragePath?.replace("original.jpg", "display.jpg")}`);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("resolves the bootstrap-shaped private photo through the same signed rendition path as Plant Detail", async () => {
    mocks.resolvePhotoUrl.mockResolvedValue("https://signed.example/owner/existing-photo/display.jpg");
    render(<ReviewHarness />);
    const image = await screen.findByAltText("Common Mint, Mentha") as HTMLImageElement;
    expect(image.src).toContain("owner/existing-photo/display.jpg");
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledWith(expect.objectContaining({ id: "existing-photo", src: "", backendStoragePath: "owner/existing-photo/original.jpg" }), "display");
  });

  it("uses each Plant Instance photo when advancing and never carries the prior working photo", async () => {
    render(<MultiPlantPhotoHarness />);
    expect((await screen.findByAltText("Common Mint, Mentha") as HTMLImageElement).src).toContain("data:image/jpeg;base64,bWludC1waG90bw==");
    fireEvent.click(screen.getByRole("button", { name: "Advance plant" }));
    const nextHero = await screen.findByAltText("Red Romaine Lettuce, Lactuca") as HTMLImageElement;
    await waitFor(() => expect(nextHero.src).toContain("owner/romaine-photo/display.jpg"));
    expect(nextHero.src).not.toContain("bWludC1waG90bw==");
  });

  it("keeps Ask Garden enabled and AI Check disabled until a temporary photo is selected", async () => {
    render(<ReviewHarness />);

    const existing = await screen.findByAltText("Common Mint, Mentha") as HTMLImageElement;
    expect(existing.src).toContain("owner/existing-photo/display.jpg");

    expect(screen.getByRole("button", { name: "AI Check" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("link", { name: "Ask Garden" })).toBeTruthy();
    const controls = screen.getByTestId("care-photo-actions");
    expect(controls.className).toContain("absolute top-3 left-1/2");
    expect(controls.className).toContain("-translate-x-1/2");
    expect(controls.className).not.toContain("right-3");
    expect(controls.querySelector("[data-slot='photo-source-picker']")?.className ?? controls.querySelector(".relative")?.className).toContain("[&_button]:!bg-transparent");
    expect(controls.querySelector(".relative")?.className).toContain("[&_button]:!bg-transparent");
    expect(controls.querySelector(".relative")?.className).toContain("[&_button]:!rounded-none");
    expect(controls.querySelector(".relative")?.className).toContain("[&_button]:!min-h-11");
    expect(controls.querySelector(".relative")?.className).toContain("[&_button]:!shadow-none");
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose from Photo Library" })).toBeTruthy();

    const inputs = controls.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs[0]?.getAttribute("capture")).toBe("environment");
    const file = new File(["photo"], "review.jpg", { type: "image/jpeg" });
    fireEvent.change(inputs[1]!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("button", { name: "AI Check" }).hasAttribute("disabled")).toBe(false));
    const hero = screen.getByAltText("Common Mint, Mentha") as HTMLImageElement;
    expect(hero.src).toContain("data:image/jpeg;base64,");
    expect(mocks.runAiCheckDraft).not.toHaveBeenCalled();
  });

  it("keeps the genuine no-photo fallback and allows the camera input to choose the working image", async () => {
    render(<ReviewHarness existingPhotos={[]} />);
    expect(screen.queryByAltText("Common Mint, Mentha")).toBeNull();
    const controls = screen.getByTestId("care-photo-actions");
    const camera = controls.querySelector('input[capture="environment"]') as HTMLInputElement;
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
    fireEvent.change(camera, { target: { files: [new File(["camera"], "camera.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect((screen.getByAltText("Common Mint, Mentha") as HTMLImageElement).src).toContain("data:image/jpeg;base64,"));
    expect((screen.getByRole("button", { name: "AI Check" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps both lightweight Care photo actions localized in Spanish", () => {
    render(<ReviewHarness language="es" />);
    expect(screen.getByRole("button", { name: "Tomar foto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Elegir de Fotos" })).toBeTruthy();
  });

  it("runs the current cycle check inline and gives Ask Garden the photo-derived result context", async () => {
    mocks.runAiCheckDraft.mockResolvedValue({ proposal: {
      headline: "New leaves are visible",
      summary: "A current visual check.",
      confidence: "medium",
      observations: ["Several new leaves are visible."],
      interpretations: ["Growth may be progressing."],
      uncertainty: ["The framing differs from older photos."],
      development_recommendations: [{ kind: "pruning", recommendation: "no_action", rationale: "No pruning is supported today.", confidence: "medium" }],
      possible_harvest_readiness: "possible_evaluate",
      suggested_next_actions: [{ kind: "evaluate_harvest_readiness", rationale: "Check whether the outer leaves support selective harvest." }],
    }, requestId: "request-care-check" });
    mocks.askGardenAi.mockResolvedValue({ answer_type: "answer", answer: "The check notes new leaves.", confirmed_facts: [], suggested_next_actions: [] });
    const onRecord = vi.fn();
    const onNext = vi.fn();
    const onSkip = vi.fn();
    render(<ReviewHarness onRecord={onRecord} onNext={onNext} onSkip={onSkip} />);

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[1]!, { target: { files: [new File(["photo"], "review.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect((screen.getByRole("button", { name: "AI Check" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "AI Check" }));

    expect(await screen.findByText("Check whether the outer leaves support selective harvest.")).toBeTruthy();
    expect(screen.getByText("What to do today")).toBeTruthy();
    fireEvent.click(screen.getByText("View full analysis"));
    expect(screen.getByRole("heading", { name: "New leaves are visible" })).toBeTruthy();
    expect(mocks.runAiCheckDraft).toHaveBeenCalledWith("cycle-mint", expect.stringContaining("data:image/jpeg;base64,"), "en");
    expect(screen.getByText("Visual observation")).toBeTruthy();
    expect(screen.getAllByText("Inference").length).toBeGreaterThan(0);
    expect(onRecord).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Attach a photo" }));
    const fileInputs = screen.getByRole("dialog").querySelectorAll<HTMLInputElement>('input[type="file"]');
    const attachedPicker = fileInputs[fileInputs.length - 1]!;
    fireEvent.change(attachedPicker, { target: { files: [new File(["context"], "wider.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByAltText("Attached photo")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Ask about this…"), { target: { value: "What should I watch for?" } });
    fireEvent.submit(screen.getByPlaceholderText("Ask about this…").closest("form")!);
    await waitFor(() => expect(mocks.askGardenAi).toHaveBeenCalled());
    const context = mocks.askGardenAi.mock.calls[0]![1][0].answer as string;
    expect(context).toContain("plant-mint");
    expect(context).toContain("cycle-mint");
    expect(context).toContain("Care Session item: 2 of 8");
    expect(context).toContain("Garden One");
    expect(context).toContain("attached to this follow-up");
    expect(context).toContain("Several new leaves are visible.");
    expect(mocks.askGardenAi.mock.calls[0]![2]).toMatchObject({ photoDataUrl: expect.stringContaining("data:image/jpeg;base64,"), context: expect.stringContaining("Harvest readiness"), messageImageDataUrl: expect.stringContaining("data:image/jpeg;base64,") });
    expect(onRecord).not.toHaveBeenCalled();
    expect(JSON.parse(screen.getByTestId("inspection-state").textContent ?? "{}").conversation[0].imageDataUrl).toContain("data:image/jpeg;base64,");
    expect(JSON.parse(screen.getByTestId("inspection-state").textContent ?? "{}").checkRequestId).toBe("request-care-check");

    fireEvent.click(screen.getByRole("button", { name: "Toggle Care item" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle Care item" }));
    expect((screen.getByAltText("Common Mint, Mentha") as HTMLImageElement).src).toContain("data:image/jpeg;base64,");
    expect(screen.getByText("Check whether the outer leaves support selective harvest.")).toBeTruthy();
    expect(screen.getByText("The check notes new leaves.")).toBeTruthy();
    expect(screen.getByAltText("Attached photo")).toBeTruthy();
  });
});
