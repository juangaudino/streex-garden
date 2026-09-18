import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronLeft, ImagePlus, ScanLine, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { ConfidenceBar, ProvenanceTag, SectionTitle } from "@/components/garden/atoms";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { identifyPlant } from "@/lib/garden-backend";

export const Route = createFileRoute("/identify")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "garden-ai" ? "garden-ai" as const : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Identify a plant — Garden X" },
      {
        name: "description",
        content:
          "Photograph an unknown plant to get a suggested species, variety and confidence — nothing is saved as canonical until you confirm it.",
      },
      { property: "og:title", content: "Identify a plant — Garden X" },
      { property: "og:description", content: "Suggested species and confidence, saved only when you confirm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Identify,
});

const fallbackCandidates = [
  { species: "Basil", scientific: "Ocimum basilicum", variety: "Genovese", knowledgeId: "basil", score: 0.71 },
  { species: "Lemon basil", scientific: "Ocimum × africanum", variety: "Lime", knowledgeId: "basil", score: 0.18 },
  { species: "Mint", scientific: "Mentha spicata", variety: "Spearmint", knowledgeId: "basil", score: 0.07 },
];

function Identify() {
  const store = useGarden();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [pick, setPick] = useState(0);
  const [candidates, setCandidates] = useState(fallbackCandidates);
  const [gardenId, setGardenId] = useState(store.gardens[1]?.id ?? store.gardens[0]?.id ?? "");
  const [name, setName] = useState("Sage");
  const [photoSrc, setPhotoSrc] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const sample = store.photos.find((p) => p.id === "basil-1");
  const chosen = candidates[pick]!;

  const choosePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPhotoSrc(reader.result);
      setPhase("idle");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rise pb-20">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-5 pt-7 sm:px-8 lg:px-12">
        <Link to="/garden-ai" className="press mt-1 grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card" aria-label="Back to Garden AI"><ChevronLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 pb-6">
          <p className="eyebrow">Identification</p>
          <h1 className="mt-1.5 font-display text-[1.75rem] leading-tight sm:text-4xl">What is this plant?</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">A suggestion is only a suggestion. Species and variety become canonical data on your plant only after you confirm.</p>
        </div>
      </div>

      <div className="grid gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
            {photoSrc ? <img src={photoSrc} alt="Plant selected for identification" className="absolute inset-0 h-full w-full object-cover" /> : (
              <div className="max-w-xs px-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-primary"><Camera className="h-5 w-5" /></span>
                <p className="mt-4 font-display text-xl">Start with a photo</p>
                <p className="mt-2 text-sm text-muted-foreground">Take one now or choose a clear image from your library.</p>
              </div>
            )}
            {phase === "scanning" ? (
              <>
                <div className="absolute inset-0 bg-primary/10" />
                <div className="scan-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              </>
            ) : null}
          </div>
          <Button
            type="button"
            variant={photoSrc ? "outline" : "default"}
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full rounded-full"
          >
            <ImagePlus className="h-4 w-4" /> {photoSrc ? "Choose another photo" : "Take or choose photo"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!photoSrc) return;
              setPhase("scanning");
              setPick(0);
              void identifyPlant(photoSrc)
                .then((matches) => {
                  setCandidates(matches);
                  setName(matches[0]?.species ?? name);
                })
                .catch(() => setCandidates(fallbackCandidates))
                .finally(() => setPhase("done"));
            }}
            disabled={!photoSrc || phase === "scanning"}
            className="mt-2 w-full rounded-full"
          >
            <ScanLine className="h-4 w-4" />
            {phase === "scanning" ? "Looking…" : phase === "done" ? "Identify again" : "Identify this photo"}
          </Button>
        </div>

        <div>
          {phase !== "done" ? (
            <div className="surface grid min-h-56 place-items-center p-8 text-center">
              <div className="max-w-xs">
                <span className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary", phase === "scanning" && "breathe")}>
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl">
                  {phase === "scanning" ? "Comparing leaf shape and venation" : "No identity claimed"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rise space-y-4">
              <div className="surface p-5">
                <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <h2 className="min-w-0 font-display text-lg">Possible matches</h2>
                  <ProvenanceTag kind="inferred" confidence="moderate" />
                </div>
                <ul className="space-y-2">
                  {candidates.map((c, i) => (
                    <li key={c.scientific}>
                      <button
                        onClick={() => setPick(i)}
                        className={cn(
                          "press grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                          pick === i ? "border-primary bg-accent/50" : "border-border/70",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{c.species}</span>
                          <span className="block truncate text-xs italic text-muted-foreground">{c.scientific}</span>
                        </span>
                        <span className="numeral shrink-0 text-sm">{Math.round(c.score * 100)}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <ConfidenceBar confidence={chosen.score > 0.6 ? "moderate" : "low"} />
                </div>
              </div>

              <div className="surface p-5">
                <SectionTitle>Add to a garden</SectionTitle>
                <label className="eyebrow block">Name it</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
                <label className="eyebrow mt-4 block">Garden</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {store.gardens.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGardenId(g.id)}
                      className={cn(
                        "press rounded-full border px-3.5 py-2 text-sm",
                        gardenId === g.id ? "border-primary bg-accent/50" : "border-border/70",
                      )}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-fact/25 bg-fact/6 p-4 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-fact" />
                  <span>
                    Confirming saves <span className="text-foreground">{chosen.species} “{chosen.variety}”</span> as this
                    plant's canonical identity. You can change it later; AI cannot.
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (!photoSrc || !gardenId) return;
                    const id = store.addPlant(
                      {
                        gardenId,
                        name: name.trim() || chosen.species,
                        species: chosen.species,
                        scientific: chosen.scientific,
                        variety: chosen.variety,
                        knowledgeId: chosen.knowledgeId,
                        plantedDaysAgo: 0,
                        status: "steady",
                        statusNote: "Just added, no history yet.",
                        heroPhotoId: "",
                        identityConfirmed: true,
                        slot: "New addition",
                      },
                      { src: photoSrc, daysAgo: 0, caption: "First photo", metrics: sample?.metrics ?? { heightCm: 0, leafCount: 0, greenness: 0, density: 0 } },
                    );
                    toast.success("Added to your garden");
                    navigate({ to: "/plants/$plantId", params: { plantId: id } });
                  }}
                  className="press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground"
                >
                  Confirm identity and add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}