import { describe, expect, it } from "vitest";
import {
  isSupportedPhotoFile,
  normalizePhotoDataUrl,
  normalizePhotoFile,
  photoFileSignature,
  PHOTO_ACCEPT,
} from "./photo-input";

describe("photo input validation", () => {
  it("accepts the image formats supported by the existing upload pipeline", () => {
    for (const type of ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]) {
      expect(isSupportedPhotoFile({ type, name: "plant.jpg" })).toBe(true);
    }
    expect(PHOTO_ACCEPT).toContain("image/heic");
  });

  it("rejects unsupported drops and gives duplicate handling a stable identity", () => {
    expect(isSupportedPhotoFile({ type: "application/pdf", name: "plant.pdf" })).toBe(false);
    expect(isSupportedPhotoFile({ type: "", name: "plant.jpg" })).toBe(true);
    expect(isSupportedPhotoFile({ type: "application/pdf", name: "plant.jpg" })).toBe(false);
    expect(
      normalizePhotoDataUrl("data:application/octet-stream;base64,ZmFrZQ==", {
        type: "",
        name: "plant.jpg",
      }),
    ).toBe("data:image/jpeg;base64,ZmFrZQ==");
    const normalized = normalizePhotoFile(new File(["bytes"], "plant.jpg", { type: "" }));
    expect(normalized.type).toBe("image/jpeg");
    expect(photoFileSignature({ name: "plant.jpg", size: 42, lastModified: 10 })).toBe(
      "plant.jpg\u000042\u000010",
    );
  });
});
