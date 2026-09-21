import { useRef, type ChangeEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ui, type UiLanguage } from "@/lib/ui-copy";

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
    if (file) onFile(file);
  };

  return (
    <div className={className}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
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
    </div>
  );
}
