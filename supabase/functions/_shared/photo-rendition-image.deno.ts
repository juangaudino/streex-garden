import {
  ImageMagick,
  MagickColors,
  MagickFormat,
  MagickImageInfo,
} from "npm:@imagemagick/magick-wasm@0.0.43";
import {
  encodePhotoRendition,
  initializePhotoRenditionEncoder,
} from "./photo-rendition-image.ts";

Deno.test("photo renditions encode JPEGs at bounded dimensions without upscaling", async () => {
  await initializePhotoRenditionEncoder();
  const source = ImageMagick.read(
    MagickColors.White,
    2400,
    1200,
    (image) => image.write(MagickFormat.Png, (bytes) => bytes.slice()),
  );

  const preview = encodePhotoRendition(source, "preview");
  const display = encodePhotoRendition(source, "display");
  const previewInfo = MagickImageInfo.create(preview.bytes);
  const displayInfo = MagickImageInfo.create(display.bytes);
  if (
    previewInfo.format !== MagickFormat.Jpeg || preview.width !== 640 ||
    preview.height !== 320 || preview.quality !== 68
  ) throw new Error("Preview rendition does not match the current contract.");
  if (
    displayInfo.format !== MagickFormat.Jpeg || display.width !== 1600 ||
    display.height !== 800 || display.quality !== 78
  ) throw new Error("Display rendition does not match the current contract.");

  const small = ImageMagick.read(
    MagickColors.White,
    320,
    200,
    (image) => image.write(MagickFormat.Png, (bytes) => bytes.slice()),
  );
  const noUpscale = encodePhotoRendition(small, "preview");
  if (noUpscale.width !== 320 || noUpscale.height !== 200) {
    throw new Error("Small source image was unexpectedly upscaled.");
  }
});
