// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Photo } from "@/lib/garden-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePhotoUrl: vi.fn(),
  persistPhotoRendition: vi.fn(),
  reportPhotoMediaDiagnostic: vi.fn(),
}));

vi.mock("@/lib/garden-backend", () => mocks);

import { PhotoImage } from "./photo-image";

const makePhoto = (id: string): Photo => ({
  id,
  plantId: "plant-1",
  src: "",
  daysAgo: 0,
  caption: id,
  backendStoragePath: `owner/${id}/original.jpg`,
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
});

type ObserverCallback = IntersectionObserverCallback;
class TestIntersectionObserver {
  static callbacks: ObserverCallback[] = [];
  readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    TestIntersectionObserver.callbacks.push(callback);
  }
  observe() {}
  disconnect() {}
  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("PhotoImage", () => {
  beforeEach(() => {
    mocks.resolvePhotoUrl.mockReset();
    mocks.persistPhotoRendition.mockReset();
    TestIntersectionObserver.callbacks = [];
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("waits to resolve off-screen private thumbnails until their lazy intersection", async () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    mocks.resolvePhotoUrl.mockResolvedValue("https://signed/preview");
    render(<PhotoImage photo={makePhoto("lazy-photo")} alt="A lettuce" />);

    expect(mocks.resolvePhotoUrl).not.toHaveBeenCalled();
    TestIntersectionObserver.callbacks[0]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe("https://signed/preview"),
    );
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledTimes(1);
  });

  it("blocks a signed master URL returned by a legacy public-story fallback", async () => {
    const legacySharePhoto = {
      ...makePhoto("legacy-share"),
      backendStoragePath: undefined,
      src: "https://project.supabase.co/storage/v1/object/sign/garden-originals/owner/photo/original.jpg?token=private",
    };
    render(
      <PhotoImage
        photo={legacySharePhoto}
        alt="Shared plant photo"
        rendition="display"
        loading="eager"
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Shared plant photo" }).getAttribute("data-photo-state"),
      ).toBe("unavailable"),
    );
    expect(document.querySelector('img[src*="original.jpg"]')).toBeNull();
    expect(mocks.resolvePhotoUrl).not.toHaveBeenCalled();
  });

  it("resolves Before/After independently and leaves one failed rendition explicit", async () => {
    mocks.resolvePhotoUrl.mockImplementation((photo: Photo, rendition: string) => {
      if (photo.id === "before" && rendition === "display")
        return Promise.reject(
          Object.assign(new Error("display not found"), { name: "PhotoRenditionUnavailableError" }),
        );
      return Promise.resolve(`https://signed/${photo.id}/${rendition}`);
    });
    render(
      <>
        <PhotoImage photo={makePhoto("before")} alt="Before" rendition="display" loading="eager" />
        <PhotoImage photo={makePhoto("after")} alt="After" rendition="display" loading="eager" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Before" }).getAttribute("data-photo-state")).toBe(
        "unavailable",
      );
      expect(screen.getByRole("img", { name: "After" }).getAttribute("src")).toBe(
        "https://signed/after/display",
      );
    });
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledTimes(2);
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: "before" }),
      "display",
      { refresh: false },
    );
  });

  it("does not let an old photo resolution replace the image after a fast selection change", async () => {
    const pending = new Map<string, (value: string) => void>();
    mocks.resolvePhotoUrl.mockImplementation(
      (photo: Photo) => new Promise((resolve) => pending.set(photo.id, resolve)),
    );
    const { rerender } = render(
      <PhotoImage
        photo={makePhoto("first")}
        alt="Selected photo"
        rendition="display"
        loading="eager"
      />,
    );
    rerender(
      <PhotoImage
        photo={makePhoto("second")}
        alt="Selected photo"
        rendition="display"
        loading="eager"
      />,
    );

    pending.get("first")?.("https://signed/first/display");
    pending.get("second")?.("https://signed/second/display");
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Selected photo" }).getAttribute("src")).toBe(
        "https://signed/second/display",
      ),
    );
  });

  it("shows one failed rendition and retries that same tier only after a manual action", async () => {
    mocks.resolvePhotoUrl
      .mockRejectedValueOnce(
        Object.assign(new Error("preview missing"), { name: "PhotoRenditionUnavailableError" }),
      )
      .mockResolvedValueOnce("https://signed/recovered/display");
    render(
      <PhotoImage
        photo={makePhoto("retry-photo")}
        alt="Compare photo"
        rendition="display"
        loading="eager"
        failureMessage="Photo could not be loaded"
        retryLabel="Try again"
      />,
    );
    expect(await screen.findByText("Photo could not be loaded")).toBeTruthy();
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(document.querySelector('img[alt="Compare photo"]')?.getAttribute("src")).toBe(
        "https://signed/recovered/display",
      ),
    );
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledTimes(2);
    expect(mocks.resolvePhotoUrl.mock.calls.map((call) => call[1])).toEqual(["display", "display"]);
    fireEvent.error(document.querySelector('img[alt="Compare photo"]')!);
    await screen.findByText("Photo could not be loaded");
    expect(mocks.resolvePhotoUrl).toHaveBeenCalledTimes(2);
  });
});
