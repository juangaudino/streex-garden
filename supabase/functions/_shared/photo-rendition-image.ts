import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickImageInfo,
} from "npm:@imagemagick/magick-wasm@0.0.43";
import {
  PHOTO_RENDITION_SPECS,
  photoRenditionDimensions,
} from "./photo-rendition-spec.mjs";

const MAX_IMAGE_PIXELS = 16_000_000;

export type PhotoRenditionKind = "preview" | "display";
export type EncodedPhotoRendition = {
  bytes: Uint8Array;
  width: number;
  height: number;
  quality: number;
};

let initialization: Promise<void> | null = null;

export function initializePhotoRenditionEncoder() {
  if (!initialization) {
    initialization = (async () => {
      const packageSpecifier = "npm:@imagemagick/magick-wasm@0.0.43";
      const wasmUrl = new URL(
        import.meta.resolve(packageSpecifier + "/magick.wasm"),
      );
      await initializeImageMagick(await Deno.readFile(wasmUrl));
    })();
  }
  return initialization;
}

export function encodePhotoRendition(
  source: Uint8Array,
  kind: PhotoRenditionKind,
) {
  const spec = PHOTO_RENDITION_SPECS.find((item) => item.kind === kind);
  if (!spec) throw new Error("Unsupported photo rendition kind.");
  const sourceInfo = MagickImageInfo.create(source);
  if (
    sourceInfo.width < 1 || sourceInfo.height < 1 ||
    sourceInfo.width * sourceInfo.height > MAX_IMAGE_PIXELS
  ) {
    throw new Error("Image exceeds the safe pixel limit.");
  }

  const result = ImageMagick.read(source, (image): EncodedPhotoRendition => {
    // Match browser ImageBitmap orientation and canvas output, which does not
    // carry source EXIF metadata into the derived JPEG.
    image.autoOrient();
    const dimensions = photoRenditionDimensions(
      image.width,
      image.height,
      spec.maxEdge,
    );
    if (
      dimensions.width !== image.width || dimensions.height !== image.height
    ) {
      image.resize(dimensions.width, dimensions.height);
    }
    image.strip();
    image.quality = spec.quality;
    const bytes = image.write(MagickFormat.Jpeg, (output) => output.slice());
    return {
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      quality: spec.quality,
    };
  });

  const encodedInfo = MagickImageInfo.create(result.bytes);
  if (
    encodedInfo.format !== MagickFormat.Jpeg ||
    encodedInfo.width !== result.width ||
    encodedInfo.height !== result.height ||
    result.bytes.byteLength === 0
  ) {
    throw new Error("Encoded rendition failed validation.");
  }
  return result;
}
