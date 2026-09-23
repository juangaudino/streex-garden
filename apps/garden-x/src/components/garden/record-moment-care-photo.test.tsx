// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Plant } from "@/lib/garden-data";
import { RecordMomentSheet } from "./record-moment";

const mocks = vi.hoisted(() => ({
  addPhoto: vi.fn(),
  addEvent: vi.fn(),
}));

vi.mock("@/lib/garden-store", () => ({
  useGarden: () => ({
    language: "en",
    gardens: [],
    plants: [],
    photos: [],
    events: [],
    tasks: [],
    addPhoto: mocks.addPhoto,
    addEvent: mocks.addEvent,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => <button {...props}>{children}</button>,
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
  heroPhotoId: "",
  identityConfirmed: true,
  backendGrowCycleId: "cycle-mint",
};

describe("Record a Moment photo reuse from a Care review", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("attaches the selected temporary review photo only when the user saves an observation", async () => {
    mocks.addPhoto.mockReturnValue("photo-review-1");
    mocks.addEvent.mockResolvedValue(undefined);
    const selectedReviewPhoto = "data:image/jpeg;base64,cGxhbnQ=";
    render(<RecordMomentSheet plant={plant} open initialFlow="observation" initialPhotoDataUrl={selectedReviewPhoto} onClose={vi.fn()} />);

    const preview = screen.getByAltText("New moment") as HTMLImageElement;
    expect(preview.src).toBe(selectedReviewPhoto);
    expect(mocks.addPhoto).not.toHaveBeenCalled();
    expect(mocks.addEvent).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Lower leaves paler than last week, new growth still tight…"), {
      target: { value: "New leaves visible" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save observation" }));

    await waitFor(() => expect(mocks.addEvent).toHaveBeenCalled());
    expect(mocks.addPhoto).toHaveBeenCalledWith(expect.objectContaining({ plantId: "plant-mint", src: selectedReviewPhoto }));
    expect(mocks.addEvent.mock.calls[0]![0]).toEqual(expect.objectContaining({ plantId: "plant-mint", photoId: "photo-review-1" }));
    expect(mocks.addEvent.mock.calls[0]![1]).toEqual(expect.objectContaining({ photo: expect.objectContaining({ src: selectedReviewPhoto }), waitForPersistence: true }));
  });
});
