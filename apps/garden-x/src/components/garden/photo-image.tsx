import { useEffect, useState, type ImgHTMLAttributes } from "react";
import type { Photo } from "@/lib/garden-data";
import { resolvePhotoUrl, type PhotoRendition } from "@/lib/garden-backend";
import { cn } from "@/lib/utils";

type PhotoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  photo: Photo;
  alt: string;
  rendition?: PhotoRendition;
};

/** Private garden images resolve on demand and remain natively lazy-loaded. */
export function PhotoImage({ photo, alt, className, loading = "lazy", rendition = "original", ...props }: PhotoImageProps) {
  const [src, setSrc] = useState(photo.src);
  const { id, src: photoSrc, backendStoragePath } = photo;

  useEffect(() => {
    let active = true;
    setSrc(photoSrc);
    const photoRef = backendStoragePath
      ? { id, src: photoSrc, backendStoragePath }
      : { id, src: photoSrc };
    void resolvePhotoUrl(photoRef, rendition)
      .then((url) => {
        if (active && url) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, photoSrc, backendStoragePath, rendition]);

  if (!src) {
    return <div aria-label={alt} role="img" className={cn("bg-secondary", className)} />;
  }
  return <img {...props} src={src} alt={alt} loading={loading} className={className} />;
}
