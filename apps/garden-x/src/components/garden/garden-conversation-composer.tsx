import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { isSupportedPhotoFile, normalizePhotoDataUrl, supportedPhotoMimeType } from "@/lib/photo-input";
import { ui, type UiLanguage } from "@/lib/ui-copy";

const supportedAiImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxConversationImageChars = 7_000_000;

function conversationImageError(file: Pick<File, "type" | "name" | "size">) {
  if (!isSupportedPhotoFile(file) || !supportedAiImageTypes.has(supportedPhotoMimeType(file) ?? "")) return "unsupported" as const;
  if (file.size * 1.4 > maxConversationImageChars) return "too-large" as const;
  return null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(normalizePhotoDataUrl(reader.result, file)) : reject(new Error("Image could not be read"));
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(file);
  });
}

export function GardenConversationComposer({
  language,
  placeholder,
  sendLabel,
  disabled = false,
  sending = false,
  onSend,
}: {
  language: UiLanguage;
  placeholder: string;
  sendLabel: string;
  disabled?: boolean;
  sending?: boolean;
  onSend: (question: string, imageDataUrl?: string) => Promise<void> | void;
}) {
  const [question, setQuestion] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string>();
  const questionRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reason = conversationImageError(file);
    if (reason) {
      setError(ui(language, reason === "too-large" ? "conversationPhotoTooLarge" : "conversationPhotoUnsupported"));
      return;
    }
    setError(undefined);
    setReading(true);
    void readAsDataUrl(file).then((dataUrl) => {
      if (dataUrl.length > maxConversationImageChars) throw new Error("Image is too large");
      setImageDataUrl(dataUrl);
      setPickerOpen(false);
    }).catch(() => {
      setError(ui(language, "conversationPhotoTooLarge"));
    }).finally(() => setReading(false));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = question.trim();
    if (!clean || disabled || sending || reading) return;
    await onSend(clean, imageDataUrl);
    setQuestion("");
    setImageDataUrl(undefined);
    setError(undefined);
    questionRef.current?.focus();
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} className="space-y-2">
      {imageDataUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2">
          <img src={imageDataUrl} alt={ui(language, "attachedPhotoPreview")} className="h-14 w-14 rounded-lg object-cover" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{ui(language, "attachedPhotoPreview")}</p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={ui(language, "removePhoto")} onClick={() => setImageDataUrl(undefined)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2">
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={disabled || sending || reading} aria-label={ui(language, "attachPhoto")}>
              <ImagePlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{ui(language, "attachPhoto")}</DialogTitle>
              <DialogDescription>{ui(language, "attachPhotoDescription")}</DialogDescription>
            </DialogHeader>
            <PhotoSourcePicker language={language} onFile={handleFile} className="flex justify-start" />
          </DialogContent>
        </Dialog>
        <input
          ref={questionRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={disabled || sending}
          placeholder={placeholder}
          className="input-soft min-w-0 text-sm"
          aria-label={placeholder}
        />
        <Button type="submit" size="sm" className="min-h-11" disabled={disabled || sending || reading || !question.trim()}>
          {reading ? "…" : sendLabel}
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
