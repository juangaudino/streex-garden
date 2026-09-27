import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import type { Photo } from "@/lib/garden-data";
import { persistPhotoRendition, resolvePhotoUrl, type PhotoRendition } from "@/lib/garden-backend";
import { cn } from "@/lib/utils";

type PhotoImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  photo: Photo;
  alt: string;
  rendition?: PhotoRendition;
  loadingMessage?: string;
  failureMessage?: string;
  retryLabel?: string;
};

type PhotoSourceState = {
  key: string;
  src: string | null;
  status: "loading" | "ready" | "failed";
};

/** Private images resolve near visibility and recover from stale/corrupt renditions. */
export function PhotoImage({
  photo,
  alt,
  className,
  style,
  loading = "lazy",
  rendition = "preview",
  onLoad,
  onError,
  loadingMessage,
  failureMessage,
  retryLabel,
  ...props
}: PhotoImageProps) {
  const { id, src: photoSrc, backendStoragePath } = photo;
  const photoRef = useMemo(
    () => (backendStoragePath ? { id, src: photoSrc, backendStoragePath } : { id, src: photoSrc }),
    [backendStoragePath, id, photoSrc],
  );
  const requestKey = `${id}|${backendStoragePath ?? ""}|${photoSrc}|${rendition}`;
  const [state, setState] = useState<PhotoSourceState | null>(null);
  const [visibleKey, setVisibleKey] = useState(
    loading === "eager" || !backendStoragePath ? requestKey : "",
  );
  const isNearViewport = loading === "eager" || !backendStoragePath || visibleKey === requestKey;
  const [manualRetry, setManualRetry] = useState(0);
  const imageRef = useRef<HTMLElement | null>(null);
  const resolveVersion = useRef(0);
  const imageFailureCount = useRef(0);
  const activeRequestKey = useRef(requestKey);
  activeRequestKey.current = requestKey;

  useEffect(() => {
    if (loading === "eager" || !backendStoragePath || typeof IntersectionObserver === "undefined") {
      setVisibleKey(requestKey);
      return;
    }
    setVisibleKey("");
    const element = imageRef.current;
    if (!element) {
      setVisibleKey(requestKey);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleKey(requestKey);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [backendStoragePath, loading, requestKey]);

  useEffect(() => {
    imageFailureCount.current = 0;
    resolveVersion.current += 1;
    let active = true;
    setState({
      key: requestKey,
      src: photoSrc || null,
      status: backendStoragePath ? "loading" : photoSrc ? "ready" : "failed",
    });
    if (!isNearViewport) {
      return () => {
        active = false;
        resolveVersion.current += 1;
      };
    }

    const isCurrent = (version: number) =>
      active && activeRequestKey.current === requestKey && resolveVersion.current === version;
    const resolveSource = async (refresh: boolean) => {
      const version = ++resolveVersion.current;
      try {
        const url = await resolvePhotoUrl(photoRef, rendition, { refresh });
        if (isCurrent(version) && url) setState({ key: requestKey, src: url, status: "ready" });
        else if (isCurrent(version)) setState({ key: requestKey, src: null, status: "failed" });
      } catch {
        if (!isCurrent(version)) return;
        if (rendition !== "original") {
          try {
            const original = await resolvePhotoUrl(photoRef, "original", { refresh: true });
            if (isCurrent(version) && original)
              setState({ key: requestKey, src: original, status: "ready" });
            else if (isCurrent(version)) setState({ key: requestKey, src: null, status: "failed" });
          } catch {
            if (isCurrent(version)) setState({ key: requestKey, src: null, status: "failed" });
          }
        } else {
          setState({ key: requestKey, src: null, status: "failed" });
        }
      }
    };

    if (!backendStoragePath) {
      return () => {
        active = false;
        resolveVersion.current += 1;
      };
    }
    void resolveSource(manualRetry > 0);
    return () => {
      active = false;
      resolveVersion.current += 1;
    };
  }, [
    backendStoragePath,
    isNearViewport,
    loading,
    manualRetry,
    photoRef,
    photoSrc,
    rendition,
    requestKey,
    visibleKey,
  ]);

  const currentState = state?.key === requestKey ? state : null;
  const visibleSrc = currentState?.src ?? null;
  const failed = currentState?.status === "failed";
  const loadingNearViewport = currentState?.status === "loading" && isNearViewport;

  const handleImageError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    if (!backendStoragePath || currentState?.status !== "ready" || imageFailureCount.current >= 2) {
      setState({ key: requestKey, src: null, status: "failed" });
      return;
    }
    imageFailureCount.current += 1;
    const fallbackRendition: PhotoRendition =
      imageFailureCount.current === 1 && rendition !== "original" ? rendition : "original";
    const version = ++resolveVersion.current;
    void resolvePhotoUrl(photoRef, fallbackRendition, { refresh: true })
      .then((url) => {
        if (activeRequestKey.current === requestKey && resolveVersion.current === version && url) {
          setState({ key: requestKey, src: url, status: "ready" });
        }
      })
      .catch(() => {
        if (activeRequestKey.current === requestKey && resolveVersion.current === version) {
          setState({ key: requestKey, src: null, status: "failed" });
        }
      });
  };

  const placeholderClass = cn("bg-secondary", className);
  if (!visibleSrc) {
    if (loadingNearViewport && loadingMessage) {
      return (
        <div
          role="status"
          aria-live="polite"
          className={cn("grid place-items-center bg-secondary p-3 text-center", className)}
        >
          <span className="text-xs text-muted-foreground">{loadingMessage}</span>
        </div>
      );
    }
    if (failed && failureMessage && retryLabel) {
      return (
        <div
          role="alert"
          className={cn("grid place-items-center gap-2 bg-secondary p-3 text-center", className)}
        >
          <span className="text-xs text-muted-foreground">{failureMessage}</span>
          <button
            type="button"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"
            onClick={() => setManualRetry((value) => value + 1)}
          >
            {retryLabel}
          </button>
        </div>
      );
    }
    return (
      <div
        ref={(element) => {
          imageRef.current = element;
        }}
        aria-label={alt}
        role="img"
        className={placeholderClass}
        style={style}
      />
    );
  }

  return (
    <img
      {...props}
      ref={(element) => {
        imageRef.current = element;
      }}
      src={visibleSrc}
      alt={alt}
      loading={loading}
      className={className}
      style={style}
      onError={handleImageError}
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
