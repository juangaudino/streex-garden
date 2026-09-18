import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** A clean full-screen look at one photograph. Nothing else. */
export function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[60] grid place-items-center">
      <button aria-label="Close photo" onClick={onClose} className="absolute inset-0 bg-ink/90 backdrop-blur-sm" />
      <img
        src={src}
        alt={alt}
        className="rise relative max-h-[92vh] max-w-[94vw] rounded-2xl object-contain shadow-lift"
      />
      <button
        onClick={onClose}
        aria-label="Close photo"
        className="press absolute top-5 right-5 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}

/** Small helper so any screen can open the viewer with one line. */
export function usePhotoViewer() {
  const [photo, setPhoto] = useState<{ src: string; alt: string } | null>(null);
  return {
    open: (src: string, alt: string) => setPhoto({ src, alt }),
    viewer: photo ? <PhotoViewer src={photo.src} alt={photo.alt} onClose={() => setPhoto(null)} /> : null,
  };
}