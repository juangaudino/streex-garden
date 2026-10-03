import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Search, Sprout, Sun } from "lucide-react";

import { PlantAdvisorDrawer } from "./plant-advisor-drawer";
import { useGardenpediaAuth } from "../gardenpedia-auth";
import type { GardenpediaPrivateView } from "../gardenpedia-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  donorPlants,
  normalizeLightFilter,
  normalizeOutdoorExposureFilter,
  seedProfileCount,
  type DonorPlant,
} from "./canonical-adapter";

type Plant = DonorPlant;
type View = "library" | "seeds" | "machines" | "calculator" | GardenpediaPrivateView;
type SeedLibraryComponent = typeof import("./seed-profile").SeedLibraryView;
type MachineLibraryComponent = typeof import("./machine-library").MachineView;
type CalculatorComponent = typeof import("./calculator-page").CalculatorPage;
type PrivateSurfaceComponent = typeof import("../private-surfaces").MyGardenSurface;

export type GardenpediaLanguage = "en" | "es";

const COPY = {
  es: {
    library: "Gardenpedia",
    seeds: "Semillas",
    machines: "Máquinas",
    calculator: "Calculadora",
    myGarden: "Mi jardín",
    subtitle: "Conocimiento vegetal · catálogo canónico",
    growGuide: "Guía de cultivo",
    title: "Cultiva con contexto y evidencia",
    description:
      "Explora identidades con datos canónicos, procedencia visible y estados de evidencia explícitos.",
    sheets: "fichas públicas",
    evidenceLegend: "Leyenda de evidencia",
    backed: "Respaldado por fuente",
    adapted: "Adaptación de Garden",
    pending: "Necesita validación",
    search: "Busca albahaca, basil, lechuga…",
    type: "Tipo",
    light: "Luz",
    inventory: "Inventario",
    publicCatalog: "Catálogo público",
    privateInventory: "Mis semillas (requiere acceso)",
    privateUnavailable: "Disponible solo en Mi jardín",
    knowledge: "Mapa de calidad del conocimiento",
    knowledgeSub: "Unidades de evidencia evaluadas por categoría",
    catalog: "Catálogo Gardenpedia",
    ordered: "Ordenadas por identidad canónica · ES/EN",
    varieties: "identidades",
    empty: "No encontramos plantas con esos filtros.",
    publicSeeds: "Conocimiento público de semillas",
    publicSeedsBody:
      "La navegación conserva la arquitectura del donor. Los paquetes y la propiedad de semillas se muestran únicamente en el contexto privado autorizado.",
    publicMachines: "Modelos públicos de máquinas",
    machineProfile: "Ver ficha →",
    machineBoundary:
      "Machine Model, System Instance e Instance Layout permanecen como conceptos canónicos separados. Las instancias privadas no se exponen en esta ruta pública.",
    publicMachinesBody:
      "La navegación conserva la arquitectura del donor. Las instancias, mapas y estados personales no se exponen en el catálogo público.",
  },
  en: {
    library: "Gardenpedia",
    seeds: "Seeds",
    machines: "Machines",
    calculator: "Calculator",
    myGarden: "My Garden",
    subtitle: "Plant knowledge · canonical catalog",
    growGuide: "Grow Guide",
    title: "Grow with context and evidence",
    description:
      "Explore canonical identities with visible provenance and explicit evidence states.",
    sheets: "public profiles",
    evidenceLegend: "Evidence legend",
    backed: "Source-backed",
    adapted: "Garden adaptation",
    pending: "Needs validation",
    search: "Search basil, lettuce, tomato…",
    type: "Type",
    light: "Light",
    inventory: "Inventory",
    publicCatalog: "Public catalog",
    privateInventory: "My seeds (access required)",
    privateUnavailable: "Available only in My Garden",
    knowledge: "Knowledge Quality Map",
    knowledgeSub: "Assessed evidence units by catalog category",
    catalog: "Gardenpedia catalog",
    ordered: "Ordered by canonical identity · EN/ES",
    varieties: "identities",
    empty: "No plants match those filters.",
    publicSeeds: "Public seed knowledge",
    publicSeedsBody:
      "This navigation preserves the donor architecture. Packet ownership and personal seed inventory appear only in the authorized private context.",
    publicMachines: "Public machine models",
    machineProfile: "View profile →",
    machineBoundary:
      "Machine Model, System Instance and Instance Layout remain separate canonical concepts. Private instances are not exposed on this public route.",
    publicMachinesBody:
      "This navigation preserves the donor architecture. Personal instances, layouts, and statuses are not exposed in the public catalog.",
  },
} as const;

const categoryLabels: Record<string, string> = {
  all: "Todas",
  herbs: "Hierbas",
  "leafy greens": "Hojas verdes",
  fruits: "Frutos",
  alliums: "Alliums",
  flowers: "Flores",
  vegetables: "Vegetales",
  "root vegetables": "Raíces",
};

const lightLabels: Record<string, string> = {
  all: "Toda luz",
  high: "Luz alta",
  medium: "Luz media",
  low: "Luz baja",
};

function lightLabel(level: string, language: GardenpediaLanguage) {
  if (language === "en") {
    return (
      {
        all: "Any light",
        high: "High light",
        medium: "Medium light",
        low: "Low light",
      }[level] ?? level
    );
  }
  return lightLabels[level] ?? level;
}

function inventoryLabel(state: string, language: GardenpediaLanguage) {
  if (language === "en") {
    return { all: "Public catalog", owned: "My seeds (access required)" }[state] ?? state;
  }
  return inventoryLabels[state] ?? state;
}

const inventoryLabels: Record<string, string> = {
  all: "Catálogo público",
  owned: "Mis semillas (requiere acceso)",
};

function buildEvidenceGroups(plants: readonly Plant[]) {
  const groups = new Map<
    string,
    { family: string; count: number; backed: number; assessed: number }
  >();
  for (const plant of plants) {
    const family = plant.categoryKey;
    const current = groups.get(family) ?? { family, count: 0, backed: 0, assessed: 0 };
    current.count += 1;
    current.backed += plant.evidence.backed;
    current.assessed += plant.evidence.assessed;
    groups.set(family, current);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      score: group.assessed ? Math.round((group.backed / group.assessed) * 100) : 0,
      level:
        group.assessed === 0
          ? "low"
          : group.backed / group.assessed >= 0.7
            ? "high"
            : group.backed / group.assessed >= 0.4
              ? "medium"
              : "low",
    }))
    .sort((a, b) => b.count - a.count);
}

function categoryLabel(category: string, language: GardenpediaLanguage) {
  const labels: Record<string, string> =
    language === "es"
      ? categoryLabels
      : {
          all: "All",
          herbs: "Herbs",
          "leafy greens": "Leafy greens",
          fruiting: "Fruiting",
          fruits: "Fruit",
          alliums: "Alliums",
          flowers: "Flowers",
          vegetables: "Vegetables",
          "root vegetables": "Root vegetables",
        };
  return labels[category] ?? category;
}

export function filterDonorPlants({
  plants,
  query,
  category,
  light,
  indoorLight,
  outdoorExposure = "all",
  inventory,
  advisorIds,
}: {
  plants: readonly Plant[];
  query: string;
  category: string;
  light?: string;
  /** @deprecated Kept for callers from the previous two-axis pass. */
  indoorLight?: string;
  /** Internal compatibility for callers outside Explore; never rendered here. */
  outdoorExposure?: string;
  inventory: string;
  advisorIds?: readonly string[] | null;
}) {
  const normalized = query.trim().toLocaleLowerCase("es");
  const filtered = plants.filter((plant) => {
    const categoryMatch = category === "all" || plant.categoryKey === category;
    const normalizedLight = normalizeLightFilter(light ?? indoorLight ?? "all");
    const normalizedExposure = normalizeOutdoorExposureFilter(outdoorExposure);
    const lightMatch =
      normalizedLight === "all" ||
      (normalizedLight !== null && plant.lightRequirement === normalizedLight);
    const exposureMatch =
      normalizedExposure === "all" ||
      (normalizedExposure !== null && plant.outdoorExposures.includes(normalizedExposure));
    const inventoryMatch = inventory !== "owned";
    const searchMatch =
      !normalized ||
      [plant.name, plant.spanishName, plant.scientificName, ...plant.tags]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(normalized);
    return categoryMatch && lightMatch && exposureMatch && inventoryMatch && searchMatch;
  });
  if (!advisorIds?.length) return filtered;
  const order = new Map(advisorIds.map((id, index) => [id, index]));
  return filtered
    .filter((plant) => order.has(plant.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function GardenLibrary({
  language = "es",
  onLanguageChange,
  diagnosticOnly = false,
  initialView = "library",
  onViewChange,
  onPlantSelect,
  onSeedSelect,
  onMachineSelect,
}: {
  language?: GardenpediaLanguage;
  onLanguageChange?: (language: GardenpediaLanguage) => void;
  diagnosticOnly?: boolean;
  initialView?: View;
  onViewChange?: ((view: View) => void) | undefined;
  onPlantSelect?: ((plant: Plant) => void) | undefined;
  onSeedSelect?: ((id: string) => void) | undefined;
  onMachineSelect?: ((id: string) => void) | undefined;
}) {
  const copy = COPY[language];
  const auth = useGardenpediaAuth(!diagnosticOnly);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [light, setLight] = useState("all");
  const [inventory, setInventory] = useState("all");
  const [advisorIds, setAdvisorIds] = useState<string[] | null>(null);
  const [SeedLibraryComponent, setSeedLibraryComponent] = useState<SeedLibraryComponent | null>(
    null,
  );
  const [MachineLibraryComponent, setMachineLibraryComponent] =
    useState<MachineLibraryComponent | null>(null);
  const [CalculatorComponent, setCalculatorComponent] = useState<CalculatorComponent | null>(null);
  const [PrivateSurfaceComponent, setPrivateSurfaceComponent] =
    useState<PrivateSurfaceComponent | null>(null);
  const [diagnosticSelection, setDiagnosticSelection] = useState<Plant | null>(null);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const changeView = (next: View) => {
    setView(next);
    onViewChange?.(next);
  };

  useEffect(() => {
    let cancelled = false;
    if (view === "seeds" && !SeedLibraryComponent) {
      void import("./seed-profile").then(({ SeedLibraryView }) => {
        if (!cancelled) setSeedLibraryComponent(() => SeedLibraryView);
      });
    }
    if (view === "machines" && !MachineLibraryComponent) {
      void import("./machine-library").then(({ MachineView }) => {
        if (!cancelled) setMachineLibraryComponent(() => MachineView);
      });
    }
    if (view === "calculator" && !CalculatorComponent) {
      void import("./calculator-page").then(({ CalculatorPage }) => {
        if (!cancelled) setCalculatorComponent(() => CalculatorPage);
      });
    }
    if (privateViewFor(view) && !PrivateSurfaceComponent) {
      void import("../private-surfaces").then(({ MyGardenSurface }) => {
        if (!cancelled) setPrivateSurfaceComponent(() => MyGardenSurface);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    CalculatorComponent,
    MachineLibraryComponent,
    PrivateSurfaceComponent,
    SeedLibraryComponent,
    view,
  ]);

  const categories = useMemo(
    () => [
      "all",
      ...[
        "vegetables",
        "leafy greens",
        "herbs",
        "fruits",
        "root vegetables",
        "alliums",
        "flowers",
      ].filter((category) => donorPlants.some((plant) => plant.categoryKey === category)),
    ],
    [],
  );
  const evidenceGroups = useMemo(() => buildEvidenceGroups(donorPlants), []);
  const filteredPlants = useMemo(
    () =>
      filterDonorPlants({
        plants: donorPlants,
        query,
        category,
        light,
        inventory,
        advisorIds,
      }),
    [advisorIds, category, light, inventory, query],
  );

  if (view === "calculator") {
    if (!CalculatorComponent) return <DeferredSurface />;
    return (
      <CalculatorComponent
        language={language}
        onLanguageChange={onLanguageChange ?? (() => undefined)}
        onNavigate={(surface) => changeView(surface)}
      />
    );
  }

  const privateView = privateViewFor(view);

  return (
    <main className="garden-stage min-h-screen text-foreground">
      <div className="garden-shell mx-auto max-w-[1320px] px-4 py-4 sm:px-6 sm:py-6">
        <header className="glass-panel flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/garden-x-512.png"
              alt="Garden X"
              className="size-10 shrink-0 rounded-lg shadow-sm"
            />
            <div>
              <h1 className="font-display text-xl font-bold leading-none">
                Gardenpedia by Garden X
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.subtitle
                  .replace("catálogo canónico", `${donorPlants.length} ${copy.sheets}`)
                  .replace("canonical catalog", `${donorPlants.length} ${copy.sheets}`)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Secciones" className="glass-soft flex p-1">
              {(diagnosticOnly
                ? (["library"] as View[])
                : (["library", "seeds", "machines", "calculator"] as View[])
              ).map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  size="sm"
                  onClick={() => changeView(item)}
                  className={cn(
                    "rounded-md shadow-none",
                    view === item && "bg-background/80 text-foreground shadow-sm",
                  )}
                >
                  {item === "library"
                    ? copy.library
                    : item === "seeds"
                      ? copy.seeds
                      : item === "machines"
                        ? copy.machines
                        : copy.calculator}
                </Button>
              ))}
              {!diagnosticOnly && auth.signedIn ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => changeView(privateView ?? "my-plants")}
                  className={cn(
                    "rounded-md shadow-none",
                    privateView && "bg-background/80 text-foreground shadow-sm",
                  )}
                >
                  {copy.myGarden}
                </Button>
              ) : null}
            </nav>
            <div className="glass-soft flex p-1 text-xs font-semibold" aria-label="Idioma">
              <Button size="sm" onClick={() => onLanguageChange?.("es")} className="h-8 px-3">
                ES
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLanguageChange?.("en")}
                className={cn("h-8 px-3", language === "es" && "text-muted-foreground")}
              >
                EN
              </Button>
            </div>
          </div>
        </header>

        {diagnosticOnly && diagnosticSelection ? (
          <div className="glass-panel mt-5 p-4 text-sm" role="status">
            <p>Selected: {diagnosticSelection.name}</p>
            <p>ID: {diagnosticSelection.id}</p>
          </div>
        ) : null}

        {privateView && PrivateSurfaceComponent ? (
          <PrivateSurfaceComponent
            section={privateView}
            language={language}
            onSectionChange={changeView}
            onBack={() => changeView("library")}
          />
        ) : null}
        {privateView && !PrivateSurfaceComponent ? <DeferredSurface /> : null}
        {view === "library" && (
          <LibraryView
            advisorActive={Boolean(advisorIds?.length)}
            categories={categories}
            category={category}
            filteredPlants={filteredPlants}
            inventory={inventory}
            light={light}
            query={query}
            onAdvisorApply={setAdvisorIds}
            onAdvisorClear={() => setAdvisorIds(null)}
            onCategoryChange={setCategory}
            onInventoryChange={setInventory}
            onLightChange={setLight}
            onQueryChange={setQuery}
            language={language}
            copy={copy}
            evidenceGroups={evidenceGroups}
            onPlantSelect={onPlantSelect ?? (diagnosticOnly ? setDiagnosticSelection : undefined)}
          />
        )}
        {view === "seeds" &&
          (SeedLibraryComponent ? (
            <SeedLibraryComponent language={language} onSeedSelect={onSeedSelect} />
          ) : (
            <DeferredSurface />
          ))}
        {view === "machines" &&
          (MachineLibraryComponent ? (
            <MachineLibraryComponent copy={copy} onMachineSelect={onMachineSelect} />
          ) : (
            <DeferredSurface />
          ))}
      </div>
    </main>
  );
}

function privateViewFor(view: View): GardenpediaPrivateView | null {
  return view === "my-plants" || view === "my-seeds" || view === "my-machines" ? view : null;
}

function DeferredSurface() {
  return (
    <div className="glass-panel mt-5 grid min-h-40 place-items-center p-8 text-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function LibraryView({
  advisorActive,
  categories,
  category,
  filteredPlants,
  inventory,
  light,
  query,
  onAdvisorApply,
  onAdvisorClear,
  onCategoryChange,
  onInventoryChange,
  onLightChange,
  onQueryChange,
  language,
  copy,
  evidenceGroups,
  onPlantSelect,
}: {
  advisorActive: boolean;
  categories: string[];
  category: string;
  filteredPlants: Plant[];
  inventory: string;
  light: string;
  query: string;
  onAdvisorApply: (ids: string[]) => void;
  onAdvisorClear: () => void;
  onCategoryChange: (value: string) => void;
  onInventoryChange: (value: string) => void;
  onLightChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  language: GardenpediaLanguage;
  copy: (typeof COPY)[GardenpediaLanguage];
  evidenceGroups: {
    family: string;
    count: number;
    backed: number;
    assessed: number;
    score: number;
    level: string;
  }[];
  onPlantSelect?: ((plant: Plant) => void) | undefined;
}) {
  return (
    <div className="animate-rise">
      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <section className="glass-panel p-5 sm:p-7 lg:col-span-7">
          <p className="eyebrow">{copy.growGuide}</p>
          <h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            {copy.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="glass-soft px-3 py-1.5">
              {donorPlants.length} {copy.sheets}
            </span>
            <span className="glass-soft px-3 py-1.5">{seedProfileCount} Seed Profiles V0</span>
            <span className="glass-soft px-3 py-1.5">Garden X public</span>
          </div>
        </section>
        <section className="glass-panel p-5 sm:p-7 lg:col-span-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-sm font-semibold">{copy.evidenceLegend}</h3>
            <span className="text-xs text-muted-foreground">
              {donorPlants.length} {copy.sheets}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            <EvidenceRow
              tone="high"
              label={copy.backed}
              value={`${donorPlants.reduce((total, plant) => total + plant.evidence.backed, 0)} ${language === "es" ? "unidades" : "units"}`}
            />
            <EvidenceRow
              tone="medium"
              label={copy.adapted}
              value={`${donorPlants.reduce((total, plant) => total + plant.evidence.adapted, 0)} ${language === "es" ? "unidades" : "units"}`}
            />
            <EvidenceRow
              tone="low"
              label={copy.pending}
              value={`${donorPlants.reduce((total, plant) => total + plant.evidence.pending, 0)} ${language === "es" ? "unidades" : "units"}`}
            />
          </div>
        </section>
      </div>

      <section className="glass-panel mt-5 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="glass-soft flex min-h-11 flex-1 items-center gap-3 px-4">
              <Search aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="sr-only">{copy.search}</span>
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={copy.search}
                className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </label>
            <div className="flex items-center gap-2">
              <PlantAdvisorDrawer
                activeFilters={{ category, light, inventory }}
                onApplyRecommendations={onAdvisorApply}
                language={language}
              />
              {advisorActive ? (
                <Button size="sm" variant="ghost" onClick={onAdvisorClear} className="rounded-full">
                  Quitar recomendación
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Filtrar por tipo de cultivo"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.type}
              </span>
              {categories.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={category === item ? "default" : "outline"}
                  onClick={() => onCategoryChange(item)}
                  className="rounded-full shadow-none"
                >
                  {categoryLabel(item, language)}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por luz">
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sun className="size-3" aria-hidden="true" /> {copy.light}
                </span>
                {(["all", "high", "medium", "low"] as const).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={light === item ? "default" : "outline"}
                    onClick={() => onLightChange(item)}
                    className="rounded-full shadow-none"
                  >
                    {lightLabel(item, language)}
                  </Button>
                ))}
              </div>
              <div
                className="flex flex-wrap items-center gap-2"
                aria-label="Filtrar por estado del inventario"
              >
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sprout className="size-3" aria-hidden="true" /> {copy.inventory}
                </span>
                {(["all", "owned"] as const).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={inventory === item ? "default" : "outline"}
                    disabled={item === "owned"}
                    title={item === "owned" ? copy.privateUnavailable : undefined}
                    onClick={() => onInventoryChange(item)}
                    className="rounded-full shadow-none"
                  >
                    {inventoryLabel(item, language)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="quality-map mt-5 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow text-quality-foreground/60">Evidence health · v0.1</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-quality-foreground">
              {copy.knowledge}
            </h3>
            <p className="mt-1 text-xs text-quality-foreground/60">{copy.knowledgeSub}</p>
          </div>
          <span className="text-xs text-quality-foreground/70">
            {(() => {
              const backed = donorPlants.reduce((total, plant) => total + plant.evidence.backed, 0);
              const assessed = donorPlants.reduce(
                (total, plant) => total + plant.evidence.assessed,
                0,
              );
              return `${backed}/${assessed} ${language === "es" ? "unidades respaldadas" : "source-backed units"}`;
            })()}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {evidenceGroups.map((group) => (
            <div key={group.family} className={cn("quality-cell", `quality-${group.level}`)}>
              <p className="font-display text-sm font-semibold text-quality-foreground">
                {categoryLabel(group.family, language)}
              </p>
              <p className="mt-1 text-[11px] text-quality-foreground/60">
                {group.count} {language === "es" ? "identidades" : "identities"} · {group.backed}/
                {group.assessed}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-quality-foreground/10">
                <div
                  className="h-full rounded-full bg-current"
                  style={{ width: `${group.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{copy.catalog}</p>
            <h3 className="mt-1 font-display text-2xl font-bold">
              {filteredPlants.length} {copy.varieties}
            </h3>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">{copy.ordered}</p>
        </div>
        {filteredPlants.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlants.map((plant) => (
              <article key={plant.id} className="glass-card group">
                <a
                  href={
                    onPlantSelect
                      ? undefined
                      : `/gardenpedia/?plant=${encodeURIComponent(plant.id)}`
                  }
                  onClick={
                    onPlantSelect
                      ? (event) => {
                          event.preventDefault();
                          onPlantSelect(plant);
                        }
                      : undefined
                  }
                  className="block w-full p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-3xl" aria-hidden="true">
                      {plant.emoji}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                      {categoryLabel(plant.categoryKey, language)}
                    </span>
                  </div>
                  <p className="mt-5 text-[11px] font-semibold text-accent">
                    {language === "es" ? plant.spanishName : plant.name}
                  </p>
                  <h4 className="mt-1 min-h-12 font-display text-lg font-semibold leading-tight">
                    {language === "es" ? plant.name : plant.spanishName}
                  </h4>
                  <p className="mt-1 truncate text-xs italic text-muted-foreground">
                    {plant.scientificName ||
                      (language === "es"
                        ? "Identidad científica pendiente"
                        : "Scientific identity pending")}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Check className="size-3.5" /> {plant.sourceCount}{" "}
                      {language === "es" ? "fuentes" : "sources"}
                    </span>
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="glass-panel grid min-h-48 place-items-center p-8 text-center">
            <div>
              <Search className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-medium">{copy.empty}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceRow({ tone, label, value }: { tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", `evidence-${tone}`)} />
        {label}
      </span>
      <strong className="text-xs">{value}</strong>
    </div>
  );
}
