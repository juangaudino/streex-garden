import { describe, expect, it } from "vitest";
import { isSupportedPhotoFile, photoFileSignature, PHOTO_ACCEPT } from "./photo-input";

describe("photo input validation", () => {
  it("accepts the image formats supported by the existing upload pipeline", () => {
    for (const type of ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]) {
      expect(isSupportedPhotoFile({ type })).toBe(true);
    }
    expect(PHOTO_ACCEPT).toContain("image/heic");
  });

  it("rejects unsupported drops and gives duplicate handling a stable identity", () => {
    expect(isSupportedPhotoFile({ type: "application/pdf" })).toBe(false);
    expect(photoFileSignature({ name: "plant.jpg", size: 42, lastModified: 10 })).toBe(
      "plant.jpg\u000042\u000010",
    );
  });
});
