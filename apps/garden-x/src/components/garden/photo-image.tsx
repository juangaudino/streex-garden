import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import type { Photo } from "@/lib/garden-data";
import {
  persistPhotoRendition,
  reportPhotoMediaDiagnostic,
  resolvePhotoUrl,
  type PhotoRendition,
} from "@/lib/garden-backend";
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
  status: "loading" | "available" | "unavailable" | "error";
};

function isMasterStorageUrl(src: string) {
  try {
    const pathname = decodeURIComponent(new URL(src).pathname);
    return /\/(?:original|master)(?:\.[a-z0-9]+)?$/i.test(pathname);
  } catch {
    return false;
  }
}

/** Private image tier resolves near visibility; a missing tier never falls back to the master. */
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
  const blockedDirectMaster =
    !backendStoragePath && Boolean(photoSrc && isMasterStorageUrl(photoSrc));
  const [state, setState] = useState<PhotoSourceState | null>(null);
  const [visibleKey, setVisibleKey] = useState(
    loading === "eager" || !backendStoragePath ? requestKey : "",
  );
  const isNearViewport = loading === "eager" || !backendStoragePath || visibleKey === requestKey;
  const [manualRetry, setManualRetry] = useState(0);
  const imageRef = useRef<HTMLElement | null>(null);
  const resolveVersion = useRef(0);
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
    resolveVersion.current += 1;
    let active = true;
    setState({
      key: requestKey,
      src: blockedDirectMaster ? null : photoSrc || null,
      status: backendStoragePath
        ? "loading"
        : photoSrc && !blockedDirectMaster
          ? "available"
          : "unavailable",
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
        if (isCurrent(version) && url) setState({ key: requestKey, src: url, status: "available" });
        else if (isCurrent(version)) {
          reportPhotoMediaDiagnostic("unavailable", rendition);
          setState({ key: requestKey, src: null, status: "unavailable" });
        }
      } catch (error) {
        if (!isCurrent(version)) return;
        if (error instanceof Error && error.name === "PhotoRenditionUnavailableError") {
          reportPhotoMediaDiagnostic("unavailable", rendition);
          setState({ key: requestKey, src: null, status: "unavailable" });
        } else {
          reportPhotoMediaDiagnostic("error", rendition);
          setState({ key: requestKey, src: null, status: "error" });
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
    blockedDirectMaster,
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
  const failed = currentState?.status === "error" || currentState?.status === "unavailable";
  const loadingNearViewport = currentState?.status === "loading" && isNearViewport;

  const handleImageError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    if (!backendStoragePath || currentState?.status !== "available") {
      setState({ key: requestKey, src: null, status: "error" });
      return;
    }
    reportPhotoMediaDiagnostic("error", rendition);
    setState({ key: requestKey, src: null, status: "error" });
  };

  const placeholderClass = cn("bg-secondary", className);
  if (!visibleSrc) {
    if (loadingNearViewport && loadingMessage) {
      return (
        <div
          role="status"
          aria-live="polite"
          className={cn("grid place-items-center bg-secondary p-3 text-center", className)}
          data-photo-state="loading"
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
          data-photo-state={currentState?.status}
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
        data-photo-state={currentState?.status ?? "loading"}
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
      data-photo-state="available"
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
