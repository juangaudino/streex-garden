import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronLeft, ScanLine, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { ConfidenceBar, ProvenanceTag, SectionTitle } from "@/components/garden/atoms";
import { cn } from "@/lib/utils";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { identifyPlant } from "@/lib/garden-backend";
import {
  GardenLibraryEntry,
  GardenLibraryManifest,
  loadGardenLibraryCatalog,
  searchGardenLibrary,
} from "@/lib/garden-library";

export const Route = createFileRoute("/identify")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "garden-ai" ? ("garden-ai" as const) : undefined,
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
      {
        property: "og:description",
        content: "Suggested species and confidence, saved only when you confirm.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Identify,
});

const fallbackCandidates = [
  {
    species: "Basil",
    scientific: "Ocimum basilicum",
    variety: "Genovese",
    knowledgeId: "",
    score: 0.71,
  },
  {
    species: "Lemon basil",
    scientific: "Ocimum × africanum",
    variety: "Lime",
    knowledgeId: "",
    score: 0.18,
  },
  {
    species: "Mint",
    scientific: "Mentha spicata",
    variety: "Spearmint",
    knowledgeId: "",
    score: 0.07,
  },
];

function Identify() {
  const store = useGarden();
  const language = store.language;
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [pick, setPick] = useState(0);
  const [candidates, setCandidates] = useState(fallbackCandidates);
  const [gardenId, setGardenId] = useState(store.gardens[1]?.id ?? store.gardens[0]?.id ?? "");
  const [name, setName] = useState("Sage");
  const [photoSrc, setPhotoSrc] = useState<string>();
  const [catalog, setCatalog] = useState<GardenLibraryManifest>();
  const [catalogError, setCatalogError] = useState<string>();
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryIdentity, setLibraryIdentity] = useState<GardenLibraryEntry>();
  const [saving, setSaving] = useState(false);

  const sample = store.photos.find((p) => p.id === "basil-1");
  const chosen = candidates[pick]!;
  const inferredIdentity = useMemo(() => {
    if (!catalog || !chosen) return undefined;
    const norm = (value?: string | null) => value?.trim().toLocaleLowerCase() ?? "";
    return (
      catalog.entries.find(
        (entry) =>
          norm(entry.scientificName) === norm(chosen.scientific) &&
          (!chosen.variety || norm(entry.cultivar) === norm(chosen.variety)),
      ) ??
      catalog.entries.find(
        (entry) =>
          norm(entry.commonName) === norm(chosen.species) &&
          (!chosen.variety || norm(entry.cultivar) === norm(chosen.variety)),
      )
    );
  }, [catalog, chosen]);
  const selectedIdentity = libraryIdentity ?? inferredIdentity;
  const libraryResults = useMemo(
    () => (catalog ? searchGardenLibrary(catalog, libraryQuery).slice(0, 6) : []),
    [catalog, libraryQuery],
  );

  useEffect(() => {
    if (phase !== "done" || catalog) return;
    void loadGardenLibraryCatalog()
      .then(setCatalog)
      .catch((error: unknown) =>
        setCatalogError(localizeKnownError(error, language, ui(language, "libraryUnavailable"))),
      );
  }, [phase, catalog, language]);

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
        <Link
          to="/garden-ai"
          className="press mt-1 grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card"
            aria-label={ui(language, "backToGardenAI")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 pb-6">
          <p className="eyebrow">{ui(language, "identification")}</p>
          <h1 className="mt-1.5 font-display text-[1.75rem] leading-tight sm:text-4xl">
            {ui(language, "whatPlant")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {ui(language, "identificationDescription")}
          </p>
        </div>
      </div>

      <div className="grid gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div>
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={ui(language, "identification")}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="max-w-xs px-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-primary">
                  <Camera className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl">{ui(language, "startWithPhoto")}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {ui(language, "chooseClearImage")}
                </p>
              </div>
            )}
            {phase === "scanning" ? (
              <>
                <div className="absolute inset-0 bg-primary/10" />
                <div className="scan-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              </>
            ) : null}
          </div>
          <PhotoSourcePicker
            language={language}
            onFile={choosePhoto}
            className="mt-4"
          />
          <Button
            type="button"
            onClick={() => {
              if (!photoSrc) return;
              setPhase("scanning");
              setPick(0);
              void identifyPlant(photoSrc)
                .then((matches) => {
                  setCandidates(matches);
                  setLibraryIdentity(undefined);
                  setName(matches[0]?.species ?? name);
                })
                .catch(() => setCandidates(fallbackCandidates))
                .finally(() => setPhase("done"));
            }}
            disabled={!photoSrc || phase === "scanning"}
            className="mt-2 w-full rounded-full"
          >
            <ScanLine className="h-4 w-4" />
            {phase === "scanning"
              ? ui(language, "looking")
              : phase === "done" ? ui(language, "identifyAgain") : ui(language, "identifyPhoto")}
          </Button>
        </div>

        <div>
          {phase !== "done" ? (
            <div className="surface grid min-h-56 place-items-center p-8 text-center">
              <div className="max-w-xs">
                <span
                  className={cn(
                    "mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary",
                    phase === "scanning" && "breathe",
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl">
                  {phase === "scanning"
                    ? ui(language, "comparingLeaves") : ui(language, "noIdentityClaimed")}
                </p>
              </div>
            </div>
          ) : (
            <div className="rise space-y-4">
              <div className="surface p-5">
                <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <h2 className="min-w-0 font-display text-lg">{ui(language, "possibleMatches")}</h2>
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
                          <span className="block truncate text-xs italic text-muted-foreground">
                            {c.scientific}
                          </span>
                        </span>
                        <span className="numeral shrink-0 text-sm">
                          {Math.round(c.score * 100)}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <ConfidenceBar confidence={chosen.score > 0.6 ? "moderate" : "low"} />
                </div>
              </div>

              <div className="surface p-5">
                <SectionTitle>{ui(language, "addToGarden")}</SectionTitle>
                <label className="eyebrow block">{ui(language, "nameIt")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
                <label className="eyebrow mt-4 block">{ui(language, "gardenLibraryIdentityLabel")}</label>
                {catalogError ? (
                  <p className="mt-1.5 text-sm text-destructive">{catalogError}</p>
                ) : null}
                {!catalog ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{ui(language, "checkingLibrary")}</p>
                ) : null}
                {selectedIdentity ? (
                  <div className="mt-1.5 rounded-2xl border border-border/70 bg-accent/35 px-4 py-3 text-sm">
                    <span className="font-medium">{selectedIdentity.commonName}</span>
                    <span className="block text-muted-foreground">
                      {[selectedIdentity.cultivar, selectedIdentity.scientificName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {ui(language, "chooseIdentityBeforeAdd")}
                  </p>
                )}
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder={ui(language, "searchLibraryShort")}
                  className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                />
                {libraryQuery && catalog ? (
                  <div className="mt-2 space-y-1">
                    {libraryResults.map((entry) => (
                      <button
                        type="button"
                        key={entry.libraryPlantId}
                        onClick={() => {
                          setLibraryIdentity(entry);
                          setLibraryQuery("");
                        }}
                        className="w-full rounded-xl border border-border/70 px-3 py-2 text-left text-sm"
                      >
                        <span className="font-medium">{entry.commonName}</span>
                        <span className="ml-2 text-muted-foreground">
                          {entry.cultivar || entry.scientificName}
                        </span>
                      </button>
                    ))}
                    {!libraryResults.length ? (
                      <p className="text-sm text-muted-foreground">
                        {ui(language, "libraryNoMatch")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className="eyebrow mt-4 block">{ui(language, "gardenLabel")}</label>
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
                    {ui(language, "confirmingSaves")} {" "}
                    <span className="text-foreground">
                      {chosen.species} “{chosen.variety}”
                    </span>{" "}
                    {ui(language, "canonicalIdentity")} {ui(language, "canChangeLaterAiCannot")}
                  </span>
                </div>

                <button
                  disabled={saving}
                  onClick={() => {
                    if (!photoSrc || !gardenId) return;
                    const targetGarden = store.gardens.find((garden) => garden.id === gardenId);
                    const occupied = new Set(
                      store.plants
                        .filter((plant) => plant.gardenId === gardenId && plant.backendPositionId)
                        .map((plant) => plant.backendPositionId),
                    );
                    const openPosition = targetGarden?.backendPositions?.find(
                      (position) => position.active !== false && !occupied.has(position.id),
                    );
                    if (!openPosition) {
                      toast.error(
                        ui(language, "noEmptyPosition"),
                      );
                      return;
                    }
                    if (!selectedIdentity) {
                      toast.error(ui(language, "chooseIdentityBeforeAdd"));
                      return;
                    }
                    setSaving(true);
                    void store
                      .createLibraryPlant({
                        gardenId,
                        positionId: openPosition.id,
                        libraryPlantId: selectedIdentity.libraryPlantId,
                        nickname: name.trim(),
                        plantedOn: new Date().toISOString().slice(0, 10),
                        plantedOnPrecision: "exact",
                        photo: {
                          src: photoSrc,
                          daysAgo: 0,
                          caption: ui(language, "firstPhoto"),
                          metrics: sample?.metrics ?? {
                            heightCm: 0,
                            leafCount: 0,
                            greenness: 0,
                            density: 0,
                          },
                        },
                      })
                      .then((id) => {
                      toast.success(ui(language, "addedToGarden"));
                        navigate({ to: "/plants/$plantId", params: { plantId: id } });
                      })
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error
                            ? localizeKnownError(error, language, ui(language, "savePlantFailed"))
                            : ui(language, "savePlantFailed"),
                        ),
                      )
                      .finally(() => setSaving(false));
                  }}
                  className="press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground"
                >
                  {saving ? ui(language, "saving") : ui(language, "confirmIdentityAdd")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
