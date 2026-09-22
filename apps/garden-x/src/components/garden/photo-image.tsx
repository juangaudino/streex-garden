import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import type { Photo } from "@/lib/garden-data";
import { persistPhotoRendition, resolvePhotoUrl, type PhotoRendition } from "@/lib/garden-backend";
import { cn } from "@/lib/utils";

type PhotoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  photo: Photo;
  alt: string;
  rendition?: PhotoRendition;
};

/** Private garden images resolve on demand and remain natively lazy-loaded. */
export function PhotoImage({
  photo,
  alt,
  className,
  loading = "lazy",
  rendition = "preview",
  onLoad,
  ...props
}: PhotoImageProps) {
  const [src, setSrc] = useState(photo.src);
  const { id, src: photoSrc, backendStoragePath } = photo;
  const photoRef = useMemo(
    () => backendStoragePath
      ? { id, src: photoSrc, backendStoragePath }
      : { id, src: photoSrc },
    [backendStoragePath, id, photoSrc],
  );

  useEffect(() => {
    let active = true;
    setSrc(photoSrc);
    void resolvePhotoUrl(photoRef, rendition)
      .then((url) => {
        if (active && url) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [photoRef, photoSrc, rendition]);

  if (!src) {
    return <div aria-label={alt} role="img" className={cn("bg-secondary", className)} />;
  }
  return (
    <img
      {...props}
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onLoad={(event) => {
        if (backendStoragePath) {
          void persistPhotoRendition(
            photoRef,
            rendition,
            event.currentTarget.currentSrc || event.currentTarget.src,
          );
        }
        onLoad?.(event);
      }}
    />
  );
}
