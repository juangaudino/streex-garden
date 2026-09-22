import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { ui, type UiLanguage } from "@/lib/ui-copy";
import { isSupportedPhotoFile, photoFileSignature } from "@/lib/photo-input";

type PhotoDropZoneProps = {
  language: UiLanguage;
  onFile: (file: File) => void;
  children: ReactNode;
  className?: string;
};

/** Adds desktop drag/drop to an existing photo control without changing mobile input UX. */
export function PhotoDropZone({ language, onFile, children, className = "" }: PhotoDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [rejected, setRejected] = useState(false);
  const lastDrop = useRef<{ signature: string; at: number } | null>(null);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedPhotoFile(file)) {
      setRejected(true);
      return;
    }
    setRejected(false);
    const signature = photoFileSignature(file);
    const now = Date.now();
    if (lastDrop.current?.signature === signature && now - lastDrop.current.at < 750) return;
    lastDrop.current = { signature, at: now };
    onFile(file);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[inherit] border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
          {ui(language, "dropPhotoHere")}
        </div>
      ) : null}
      {rejected ? (
        <p className="mt-2 text-xs text-destructive">{ui(language, "unsupportedPhotoType")}</p>
      ) : null}
    </div>
  );
}
