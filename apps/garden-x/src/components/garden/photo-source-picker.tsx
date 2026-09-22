import { useRef, type ChangeEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ui, type UiLanguage } from "@/lib/ui-copy";
import { PhotoDropZone } from "@/components/garden/photo-drop-zone";
import { PHOTO_ACCEPT, isSupportedPhotoFile } from "@/lib/photo-input";

type PhotoSourcePickerProps = {
  language: UiLanguage;
  onFile: (file: File) => void;
  className?: string;
};

/** Two explicit native inputs keep camera and Photo Library available on iPhone and desktop. */
export function PhotoSourcePicker({ language, onFile, className }: PhotoSourcePickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && isSupportedPhotoFile(file)) onFile(file);
  };

  return (
    <PhotoDropZone language={language} onFile={onFile} className={className}>
      <input
        ref={cameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={libraryRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        onChange={handleChange}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> {ui(language, "takePhoto")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => libraryRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" /> {ui(language, "chooseFromLibrary")}
        </Button>
      </div>
    </PhotoDropZone>
  );
}
