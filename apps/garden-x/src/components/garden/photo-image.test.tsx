// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Photo } from "@/lib/garden-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolvePhotoUrl: vi.fn(),
  persistPhotoRendition: vi.fn(),
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

  it("resolves Before/After images independently and falls back to the original when one rendition cannot be signed", async () => {
    mocks.resolvePhotoUrl.mockImplementation((photo: Photo, rendition: string) => {
      if (photo.id === "before" && rendition === "display")
        return Promise.reject(new Error("display not found"));
      return Promise.resolve(`https://signed/${photo.id}/${rendition}`);
    });
    render(
      <>
        <PhotoImage photo={makePhoto("before")} alt="Before" rendition="display" loading="eager" />
        <PhotoImage photo={makePhoto("after")} alt="After" rendition="display" loading="eager" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Before" }).getAttribute("src")).toBe(
        "https://signed/before/original",
      );
      expect(screen.getByRole("img", { name: "After" }).getAttribute("src")).toBe(
        "https://signed/after/display",
      );
    });
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

  it("refreshes a failed rendition and presents an explicit retry after both sources fail", async () => {
    mocks.resolvePhotoUrl
      .mockResolvedValueOnce("https://signed/stale/display")
      .mockResolvedValueOnce("https://signed/fresh/display")
      .mockRejectedValueOnce(new Error("display failed"))
      .mockRejectedValueOnce(new Error("original failed"))
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
    await waitFor(() =>
      expect(document.querySelector('img[alt="Compare photo"]')?.getAttribute("src")).toBe(
        "https://signed/stale/display",
      ),
    );
    const image = document.querySelector('img[alt="Compare photo"]')!;
    fireEvent.error(image);
    await waitFor(() =>
      expect(document.querySelector('img[alt="Compare photo"]')?.getAttribute("src")).toBe(
        "https://signed/fresh/display",
      ),
    );
    fireEvent.error(document.querySelector('img[alt="Compare photo"]')!);
    expect(await screen.findByText("Photo could not be loaded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(document.querySelector('img[alt="Compare photo"]')?.getAttribute("src")).toBe(
        "https://signed/recovered/display",
      ),
    );
  });
});
