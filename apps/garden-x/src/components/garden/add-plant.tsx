import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, Search, Sparkles, Sprout, X } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import {
  evaluatePlanting,
  loadGardenLibraryCatalog,
  resolvePlantingContext,
  searchGardenLibrary,
  localizedLibraryName,
  type GardenLibraryEntry,
  type GardenLibraryManifest,
} from "@/lib/garden-library";
import {
  buildEmptyGardenPositionInput,
  evaluateEmptyGardenPosition,
  verifiedMachineContextForGarden,
} from "@/lib/garden-compatibility-engine";
import {
  projectEmptyPositionCandidates,
  type EmptyPositionCandidate,
} from "@/lib/garden-compatibility-product";
import { Button } from "@/components/ui/button";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { PhotoDropZone } from "@/components/garden/photo-drop-zone";
import { PHOTO_ACCEPT, isSupportedPhotoFile } from "@/lib/photo-input";

interface Props {
  gardenId: string;
  positionId?: string | undefined;
  slot?: string | undefined;
  open: boolean;
  onClose: () => void;
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export function AddPlantSheet({ gardenId, positionId, slot, open, onClose }: Props) {
  const store = useGarden();
  const language = store.language;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<GardenLibraryManifest | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GardenLibraryEntry | null>(null);
  const [showContextualResults, setShowContextualResults] = useState(false);
  const [nickname, setNickname] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [precision, setPrecision] = useState<"exact" | "approximate" | "unknown">("exact");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const garden = store.gardens.find((g) => g.id === gardenId);

  useEffect(() => {
    if (!open) return;
    setCatalogError("");
    void loadGardenLibraryCatalog()
      .then(setCatalog)
      .catch((error: unknown) =>
        setCatalogError(localizeKnownError(error, language, ui(language, "libraryUnavailable"))),
      );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setShowContextualResults(false);
    setNickname("");
    setDate(todayInputValue());
    setPrecision("exact");
    setPhoto(null);
    setBusy(false);
    setSaveError("");
  }, [open]);

  const context = useMemo(
    () => (garden && positionId ? resolvePlantingContext(garden, positionId, store.plants) : null),
    [garden, positionId, store.plants],
  );
  const results = useMemo(
    () => (catalog ? searchGardenLibrary(catalog, query).slice(0, 12) : []),
    [catalog, query],
  );
  const contextualEvaluation = useMemo(() => {
    if (!catalog || !garden || !positionId) {
      return { candidates: [], unavailable: false, machineFact: null };
    }
    try {
      const machineContext = verifiedMachineContextForGarden(garden);
      const input = buildEmptyGardenPositionInput(
        garden,
        positionId,
        store.plants,
        catalog.entries,
        machineContext.verifiedFacts,
      );
      const evaluated = evaluateEmptyGardenPosition(input, catalog.entries);
      return {
        candidates: projectEmptyPositionCandidates(evaluated, catalog.entries, {
          cultivationMethod: garden.cultivationMethod ?? null,
          systemName: garden.machine?.name ?? null,
          machineFact: machineContext.machineFact,
        }).candidates.filter(
          (candidate) => candidate.cultivationCompatibility.state !== "incompatible",
        ),
        unavailable: false,
        machineFact: machineContext.machineFact,
      };
    } catch {
      return { candidates: [], unavailable: true, machineFact: null };
    }
  }, [catalog, garden, positionId, store.plants]);
  const contextualCandidates = contextualEvaluation.candidates;
  const libraryEntryById = useMemo(
    () => new Map(catalog?.entries.map((entry) => [entry.libraryPlantId, entry]) ?? []),
    [catalog],
  );
  const guidance = useMemo(
    () => (selected && catalog && context ? evaluatePlanting(selected, catalog, context, language) : []),
    [selected, catalog, context],
  );

  if (!open || typeof document === "undefined") return null;

  const pickPhoto = (file: File | undefined) => {
    if (!file || !isSupportedPhotoFile(file)) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const choose = (entry: GardenLibraryEntry) => {
    setSelected(entry);
    setShowContextualResults(false);
    setSaveError("");
  };
  const retryCatalog = () => {
    setCatalog(null);
    setCatalogError("");
    void loadGardenLibraryCatalog(true)
      .then(setCatalog)
      .catch((error: unknown) =>
        setCatalogError(localizeKnownError(error, language, ui(language, "libraryUnavailable"))),
      );
  };
  const save = async () => {
    if (!selected || !positionId) {
      setSaveError(ui(language, "positionUnavailable"));
      return;
    }
    if (precision !== "unknown" && !date) {
      setSaveError(ui(language, "plantingDateRequired"));
      return;
    }
    setBusy(true);
    setSaveError("");
    try {
      const id = await store.createLibraryPlant({
        gardenId,
        positionId,
        libraryPlantId: selected.libraryPlantId,
        nickname,
        plantedOn: precision === "unknown" ? null : date,
        plantedOnPrecision: precision,
        ...(photo
          ? {
              photo: {
                src: photo,
                daysAgo: 0,
                caption: "First photograph",
                metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
              },
            }
          : {}),
      });
      onClose();
      toast.success(
        language === "es"
          ? `${localizedLibraryName(selected, language)} añadida${slot ? ` a ${slot}` : ""}`
          : `${localizedLibraryName(selected, language)} added${slot ? ` to ${slot}` : ""}`,
      );
      await navigate({ to: "/plants/$plantId", params: { plantId: id } });
    } catch (error) {
      setSaveError(
        localizeKnownError(error, language, ui(language, "plantAddFailed")),
      );
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={ui(language, "close")}
        onClick={onClose}
        disabled={busy}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
      />
      <div className="rise relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card shadow-lift sm:max-w-lg sm:rounded-[2rem]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
            <Sprout className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow truncate">
              {garden?.name}
              {slot ? ` · ${slot}` : ""}
            </p>
            <p className="truncate font-display text-lg">{ui(language, "addPlant")}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={ui(language, "close")}
            className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!positionId ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {ui(language, "positionNotConnected")}
            </p>
          ) : null}
          {!selected ? (
            <>
              {showContextualResults ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{ui(language, "whatCouldPlant")}</p>
                      <h2 className="mt-1 font-display text-2xl">
                        {ui(language, "whatCouldPlant")}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ui(language, "positionEvidenceIntro")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContextualResults(false)}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      {ui(language, "backToLibrary")}
                    </button>
                  </div>
                  {!catalog && !catalogError ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {ui(language, "loadingLibrary")}
                    </p>
                  ) : null}
                  {catalog && !contextualCandidates.length ? (
                    <div className="rounded-2xl border border-border/70 bg-secondary/50 p-4 text-sm text-muted-foreground">
                      {ui(
                        language,
                        contextualEvaluation.unavailable
                          ? "positionContextUnavailable"
                          : "noContextualCandidates",
                      )}
                    </div>
                  ) : null}
                  {catalog && contextualCandidates.length
                    ? (() => {
                        const recommended = contextualCandidates.filter(
                          (candidate) => candidate.tier === "recommended",
                        );
                        const checkFirst = contextualCandidates.filter(
                          (candidate) => candidate.tier === "check_first",
                        );
                        const insufficient = contextualCandidates.filter(
                          (candidate) => candidate.tier === "insufficient_evidence",
                        );
                        const renderCards = (items: readonly EmptyPositionCandidate[]) =>
                          items.map((candidate) => (
                            <ContextualCandidateCard
                              key={candidate.plant.libraryPlantId}
                              candidate={candidate}
                              entry={libraryEntryById.get(candidate.plant.libraryPlantId)}
                              language={language}
                              onSelect={() => {
                                const entry = libraryEntryById.get(candidate.plant.libraryPlantId);
                                if (entry) choose(entry);
                              }}
                            />
                          ));
                        const shortlist = recommended.slice(0, 5);
                        const additionalRecommended = recommended.slice(5);
                        const unverifiedSystemFit = recommended.some(
                          (candidate) => candidate.systemFit.state === "unknown",
                        );
                        const unverifiedPhysicalFit = recommended.some(
                          (candidate) => candidate.physicalFit.state !== "supported",
                        );
                        return (
                          <div className="space-y-5">
                            {contextualEvaluation.machineFact ? (
                              <p className="text-xs text-muted-foreground">
                                {ui(language, "knownMachineGrowHeight")} ·{" "}
                                {contextualEvaluation.machineFact.maxGrowHeightCm} cm ·{" "}
                                <a
                                  className="underline underline-offset-2"
                                  href={contextualEvaluation.machineFact.source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {contextualEvaluation.machineFact.modelName} ·{" "}
                                  {contextualEvaluation.machineFact.source.publisher}
                                </a>
                              </p>
                            ) : null}
                            {shortlist.length ? (
                              <section aria-label={ui(language, "recommendedHere")}>
                                <h3 className="eyebrow">{ui(language, "recommendedHere")}</h3>
                                <p className="mb-2 mt-1 text-xs text-muted-foreground">
                                  {ui(language, "recommendedHereIntro")}
                                </p>
                                {unverifiedSystemFit ? (
                                  <p className="mb-1 text-xs text-muted-foreground">
                                    {ui(language, "someSystemFitUnknown")}
                                  </p>
                                ) : null}
                                {unverifiedPhysicalFit ? (
                                  <p className="mb-2 text-xs text-muted-foreground">
                                    {ui(language, "somePhysicalFitUnknown")}
                                  </p>
                                ) : null}
                                <div className="space-y-2">{renderCards(shortlist)}</div>
                                {additionalRecommended.length ? (
                                  <details className="mt-2 text-sm">
                                    <summary className="w-fit cursor-pointer font-medium text-primary">
                                      {ui(language, "moreSupportedCandidates")} ·{" "}
                                      {additionalRecommended.length}
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                      {renderCards(additionalRecommended)}
                                    </div>
                                  </details>
                                ) : null}
                              </section>
                            ) : null}
                            {checkFirst.length ? (
                              <section aria-label={ui(language, "couldWorkCheckFirst")}>
                                <h3 className="eyebrow">{ui(language, "couldWorkCheckFirst")}</h3>
                                <p className="mb-2 mt-1 text-xs text-muted-foreground">
                                  {ui(language, "checkFirstIntro")}
                                </p>
                                <div className="space-y-2">{renderCards(checkFirst)}</div>
                              </section>
                            ) : null}
                            {insufficient.length ? (
                              <details className="rounded-2xl border border-border/70 bg-secondary/40 p-3">
                                <summary className="cursor-pointer font-medium">
                                  {ui(language, "otherPlantsInsufficient")} · {insufficient.length}
                                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                                    {ui(language, "insufficientEvidenceIntro")}
                                  </span>
                                </summary>
                                <div className="mt-3 space-y-2">{renderCards(insufficient)}</div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}
                </>
              ) : (
                <>
                  <div>
                    <p className="eyebrow">{ui(language, "library")}</p>
                    <h2 className="mt-1 font-display text-2xl">{ui(language, "whatPlanting")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ui(language, "chooseDocumentedPlant")}
                    </p>
                  </div>
                  <label className="relative block">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      className="input-soft pl-9"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={ui(language, "searchCatalogExample")}
                    />
                  </label>
                  {!query && context ? (
                    <button
                      type="button"
                      onClick={() => setShowContextualResults(true)}
                      className="flex w-full items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left text-sm font-medium text-primary"
                    >
                      <Sparkles className="h-4 w-4" />
                      {ui(language, "whatCouldPlant")}
                    </button>
                  ) : null}
                </>
              )}
              {catalogError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p>{catalogError}</p>
                  <button className="mt-2 font-medium underline" onClick={retryCatalog}>
                    {ui(language, "tryAgain")}
                  </button>
                </div>
              ) : null}
              {!showContextualResults && !catalog && !catalogError ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {ui(language, "loadingLibrary")}
                </p>
              ) : null}
              {catalog && !showContextualResults ? (
                <div className="space-y-2">
                  {results.map((entry) => (
                    <button
                      type="button"
                      key={entry.libraryPlantId}
                      onClick={() => choose(entry)}
                      className="press w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-left"
                    >
                      <p className="font-medium">{localizedLibraryName(entry, language)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[entry.cultivar, entry.scientificName].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))}
                  {query && !results.length ? (
                    <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
                      {ui(language, "notFoundLibrary")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Change plant
              </button>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="eyebrow">{ui(language, "gardenLibraryIdentity")}</p>
                <p className="mt-1 font-display text-2xl">
                  {localizedLibraryName(selected, language)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[selected.cultivar, selected.scientificName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <label className="block text-sm">
                <span className="mb-2 block text-muted-foreground">
                  {ui(language, "personalName")}{" "}
                  <span className="text-xs">{ui(language, "optional").toLowerCase()}</span>
                </span>
                <input
                  className="input-soft"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder={localizedLibraryName(selected, language)}
                  maxLength={32}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block text-muted-foreground">
                    {ui(language, "datePlanting")}
                  </span>
                  <input
                    type="date"
                    max={todayInputValue()}
                    disabled={precision === "unknown"}
                    className="input-soft px-3"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block text-muted-foreground">
                    {ui(language, "datePrecision")}
                  </span>
                  <select
                    className="input-soft px-3"
                    value={precision}
                    onChange={(event) => setPrecision(event.target.value as typeof precision)}
                  >
                    <option value="exact">{ui(language, "exact")}</option>
                    <option value="approximate">{ui(language, "approximate")}</option>
                    <option value="unknown">{ui(language, "unknown")}</option>
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-sm font-medium">{ui(language, "plantingGuidance")}</p>
                <div className="mt-2 space-y-2">
                  {guidance.map((item, index) => (
                    <p key={`${item.kind}-${index}`} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.kind === "evidence-backed fit"
                          ? ui(language, "goodFit")
                          : item.kind === "consideration"
                            ? ui(language, "consideration")
                            : ui(language, "insufficientEvidence")}
                        .
                      </span>{" "}
                      {item.message}
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {ui(language, "guidanceDisclaimer")}
                </p>
              </div>
              <PhotoDropZone language={language} onFile={pickPhoto}>
                <input
                  ref={fileRef}
                  type="file"
                  accept={PHOTO_ACCEPT}
                  className="hidden"
                  onChange={(event) => pickPhoto(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {photo ? ui(language, "photoSelected") : ui(language, "addFirstPhoto")}
                </Button>
              </PhotoDropZone>
              {saveError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}
              <Button
                disabled={busy || !positionId}
                onClick={() => void save()}
                className="w-full rounded-full"
              >
                {busy ? ui(language, "addingToGarden") : ui(language, "addToPosition")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ContextualCandidateCard({
  candidate,
  entry,
  language,
  onSelect,
}: {
  candidate: EmptyPositionCandidate;
  entry: GardenLibraryEntry | undefined;
  language: "en" | "es";
  onSelect: () => void;
}) {
  const stateKey = candidate.cultivationCompatibility.state === "compatible"
    ? "cultivationEvidenceSupports"
    : candidate.cultivationCompatibility.state === "conditional"
      ? "conditionRequired"
      : "compatibilityUnknown";
  const cited = new Map<string, EmptyPositionCandidate["factualReasons"][number]["evidence"][number]>();
  for (const reason of candidate.factualReasons) {
    for (const evidence of reason.evidence) {
      const scope = evidence.taxonomicScope;
      cited.set(`${evidence.sourceId}:${evidence.property}:${scope.level}:${"taxon" in scope ? scope.taxon : ""}`, evidence);
    }
  }
  for (const evidence of candidate.supportingEvidence) {
    const scope = evidence.taxonomicScope;
    cited.set(`${evidence.sourceId}:${evidence.property}:${scope.level}:${"taxon" in scope ? scope.taxon : ""}`, evidence);
  }
  const references = [...cited.values()];

  const scopeLabel = (scope: EmptyPositionCandidate["factualReasons"][number]["evidence"][number]["taxonomicScope"]) => {
    if (scope.level === "identity") return ui(language, "identitySpecificEvidence");
    const label = scope.level === "species" ? ui(language, "speciesLevelEvidence")
      : scope.level === "genus" ? ui(language, "genusLevelEvidence")
        : ui(language, "familyLevelEvidence");
    return `${label}: ${scope.taxon}`;
  };
  const propertyLabel = (property: EmptyPositionCandidate["supportingEvidence"][number]["property"]) => ({
    cultivation_suitability: ui(language, "evidencePropertyCultivation"),
    growth_habit: ui(language, "evidencePropertyHabit"),
    mature_height: ui(language, "evidencePropertyHeight"),
    mature_spread: ui(language, "evidencePropertySpread"),
    spacing: ui(language, "evidencePropertySpacing"),
    growing_light: ui(language, "evidencePropertyLight"),
  })[property];
  const formatReason = (reason: EmptyPositionCandidate["factualReasons"][number]) => {
    if (reason.property === "cultivation_suitability") {
      return candidate.cultivationCompatibility.state === "conditional"
        ? `${ui(language, "gardenpediaCondition")}: ${reason.statement}`
        : ui(language, "documentedHydroponicEvidence");
    }
    if (reason.property === "growth_habit") {
      if (reason.statement.includes("neighboring active plant(s) have documented spreading")) {
        return ui(language, "expansiveNeighborNeedsReview");
      }
      if (reason.statement.includes("habit is documented and adjacent positions are occupied")) {
        return ui(language, "expansiveHabitNeedsClearance");
      }
      if (!reason.statement.startsWith("Documented growth habit:")) return reason.statement;
      const habit = reason.statement.split(":").slice(1).join(":").trim().replace(/\.$/, "");
      const habits = habit
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (habits.length === 0) return "";
      const translations: Record<string, string> = {
        compact: ui(language, "habitCompact"),
        upright: ui(language, "habitUpright"),
        bushy: ui(language, "habitBushy"),
        spreading: ui(language, "habitSpreading"),
        trailing: ui(language, "habitTrailing"),
        rosette: ui(language, "habitRosette"),
        clumping: ui(language, "habitClumping"),
        mounded: ui(language, "habitMounded"),
      };
      const translated = habits.map((value) => translations[value] ?? value).join(", ");
      return `${ui(language, "documentedGrowthHabit")}: ${translated}.`;
    }
    if (reason.property === "mature_height") {
      if (reason.statement.includes("within the documented system grow-height limit")) {
        const limit = reason.statement.match(/of ([\d.]+) cm/)?.[1] ?? "";
        return ui(language, "matureHeightWithinMachineLimit").replace("{height}", limit);
      }
      if (reason.statement.includes("exceeds the documented system grow-height limit")) {
        return ui(language, "matureHeightExceedsMachineLimit");
      }
    }
    return reason.statement;
  };

  const formattedReasons = candidate.factualReasons
    .slice(0, 2)
    .map((reason, index) => ({
      key: `${reason.property}-${index}`,
      text: formatReason(reason).trim(),
    }))
    .filter((reason) => reason.text.length > 0);

  return (
    <article className="rounded-2xl border border-border/70 bg-background px-4 py-3">
      <button type="button" onClick={onSelect} className="press w-full text-left">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-medium">
            {entry ? localizedLibraryName(entry, language) : candidate.plant.commonName}
          </span>
          <span className="text-xs font-medium text-primary">{ui(language, stateKey)}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {[candidate.plant.cultivar, candidate.plant.scientificName].filter(Boolean).join(" · ")}
        </span>
      </button>
      {formattedReasons.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {formattedReasons.map((reason) => (
            <li key={reason.key}>{reason.text}</li>
          ))}
        </ul>
      ) : null}
      {candidate.systemFit.state !== "unknown" || candidate.physicalFit.state !== "unknown" ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {candidate.systemFit.state === "conditional" ? (
            <span>{ui(language, "systemConditionUnconfirmed")}</span>
          ) : null}
          {candidate.systemFit.state === "documented" ? (
            <span>{ui(language, "systemConditionDocumented")}</span>
          ) : null}
          {candidate.physicalFit.state === "supported" ? (
            <span>{ui(language, "physicalFitSupported")}</span>
          ) : null}
        </div>
      ) : null}
      {references.length ? (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer font-medium text-primary">
            {ui(language, "evidenceSources")}
          </summary>
          <ul className="mt-2 space-y-1.5 pl-1">
            {references.map((evidence) => {
              const source = evidence.sourceUrl
                ? {
                    id: evidence.sourceId,
                    title: evidence.sourceTitle ?? evidence.sourceId,
                    publisher: evidence.sourcePublisher ?? "",
                    url: evidence.sourceUrl,
                  }
                : entry?.reference.sources.find(
                    (item) => item.id === evidence.sourceId,
                  );
              if (!source) return null;
              const scope = evidence.taxonomicScope;
              return (
                <li
                  key={`${source.id}:${evidence.property}:${scope.level}:${"taxon" in scope ? scope.taxon : ""}`}
                >
                  <a
                    className="underline underline-offset-2"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title} · {source.publisher}
                  </a>
                  <span className="ml-1">
                    ({propertyLabel(evidence.property)} · {scopeLabel(scope)})
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
