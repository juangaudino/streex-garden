import { describe, expect, it } from "vitest";
import {
  inspectPhotoFolder,
  isSafeOwnerOriginalPath,
  PHOTO_RENDITION_SPECS,
  photoRenditionDimensions,
  photoRenditionPath,
  selectBackfillPhotos,
} from "./photo-rendition-spec.mjs";

const ownerId = "361520ad-09bf-4901-a391-871eeb704e37";
const photoId = "b4c972fd-b19a-4b80-a5a2-9c0e6fbe647f";
const photo = {
  id: photoId,
  storage_path: ownerId + "/historical-photos-v1/garden-1/" + photoId +
    "/original.jpg",
  upload_status: "uploaded",
};
const validObject = (name: string) => ({
  name,
  metadata: { mimetype: "image/jpeg", size: 1200 },
});

describe("temporary photo rendition backfill contract", () => {
  it("shares the existing JPEG rendition dimensions, quality and sibling paths", () => {
    expect(PHOTO_RENDITION_SPECS).toEqual([
      { kind: "preview", maxEdge: 640, quality: 68 },
      { kind: "display", maxEdge: 1600, quality: 78 },
    ]);
    expect(photoRenditionPath(photo.storage_path, "preview")).toBe(
      ownerId + "/historical-photos-v1/garden-1/" + photoId + "/preview.jpg",
    );
    expect(photoRenditionPath(photo.storage_path, "display")).toBe(
      ownerId + "/historical-photos-v1/garden-1/" + photoId + "/display.jpg",
    );
  });

  it("uses the current no-upscale, aspect-preserving rounded dimensions", () => {
    expect(photoRenditionDimensions(4032, 3024, 640)).toEqual({
      width: 640,
      height: 480,
    });
    expect(photoRenditionDimensions(3024, 4032, 1600)).toEqual({
      width: 1200,
      height: 1600,
    });
    expect(photoRenditionDimensions(320, 200, 640)).toEqual({
      width: 320,
      height: 200,
    });
  });

  it("includes only uploaded records in the fixed owner scope and excludes pending", () => {
    const secondId = "d5af66e3-578f-4bb4-9d5f-2a540f2db7b2";
    const second = {
      ...photo,
      id: secondId,
      storage_path: photo.storage_path.replace(photoId, secondId),
    };
    const result = selectBackfillPhotos([
      photo,
      {
        ...photo,
        id: "f4a6932a-46bd-4b37-8222-a922bc23b6c3",
        upload_status: "pending",
      },
      {
        ...photo,
        id: "8aa87eeb-02c0-4635-8a21-1df71c8d6ca6",
        upload_status: "failed",
      },
      second,
    ], ownerId);
    expect(result.photos.map((entry) => entry.id)).toEqual(
      [photo.id, second.id].sort(),
    );
    expect(result.pendingExcluded).toBe(1);
    expect(() =>
      selectBackfillPhotos([
        { ...photo, storage_path: "another-owner/photo/original.jpg" },
      ], ownerId)
    ).toThrow(/fixed owner scope/);
  });

  it("rejects unsafe or non-original paths", () => {
    expect(isSafeOwnerOriginalPath(photo.storage_path, ownerId)).toBe(true);
    expect(isSafeOwnerOriginalPath(ownerId + "/../other/original.jpg", ownerId))
      .toBe(false);
    expect(isSafeOwnerOriginalPath(ownerId + "/photo/display.jpg", ownerId))
      .toBe(false);
  });

  it("skips only two valid JPEG sidecars and never replaces a malformed existing sidecar", () => {
    expect(inspectPhotoFolder(photo, [
      validObject("original.jpg"),
      validObject("preview.jpg"),
      validObject("display.jpg"),
    ])).toEqual({ status: "complete" });
    expect(inspectPhotoFolder(photo, [
      validObject("original.jpg"),
      validObject("preview.jpg"),
    ])).toEqual({ status: "needs_work", missingKinds: ["display"] });
    expect(inspectPhotoFolder(photo, [
      validObject("original.jpg"),
      { name: "preview.jpg", metadata: { mimetype: "image/png", size: 1200 } },
    ])).toEqual({
      status: "invalid_existing_rendition",
      invalidKinds: ["preview"],
    });
    expect(inspectPhotoFolder(photo, [])).toEqual({
      status: "missing_original",
    });
  });
});
