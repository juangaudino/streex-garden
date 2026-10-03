import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, Minus, Package, Plus, Sprout, User } from "lucide-react";

import { cn } from "@/lib/utils";

import { buildSeedLibraryCards } from "./seed-library-adapter";
import {
  type SeedProfileLanguage,
  type SeedProfileViewModel,
  type SeedStepViewModel,
} from "./seed-profile-adapter";

const copy = {
  es: {
    seeds: "Semillas",
    profile: "Perfil de semilla",
    publicKnowledge: "Conocimiento público de semillas",
    publicBody:
      "Protocolos canónicos de semilla a plántula, con evidencia visible y estados pendientes conservados.",
    publicProfile: "Perfil público",
    identities: "perfiles de semilla",
    familyUnknown: "Familia no establecida por la ficha actual",
    plantCare: "Cuidado de la planta madura",
    seedProfile: "PERFIL DE SEMILLA",
    visitor: "Visitante",
    myGarden: "Mi jardín",
    publicInventory: "Conocimiento público",
    privateBoundary: "Mi inventario",
    privateTitle: "Tus paquetes aparecen solo en Mi jardín",
    privateBody:
      "La ficha pública conserva el conocimiento de germinación. Los paquetes, lotes, stock y siembras personales requieren el contexto privado autorizado.",
    accessRequired: "Se requiere acceso",
    fromSeed: "De semilla a plántula",
    protocol: "Protocolo de germinación",
    steps: "pasos",
    protocolBody:
      "Cronología ordenada por fase. El manejo posterior —podas, cosecha y floración— vive en la ficha de la planta.",
    references: "Referencias",
    officialSources: "Fuentes de esta ficha",
    sourceBacked: "Respaldado por fuente",
    gardenAdaptation: "Adaptación de Garden",
    needsValidation: "Necesita validación",
    confidence: "Confianza",
    notEstablished: "No establecido",
    noSources: "No hay enlaces de fuente resueltos para este bloque.",
    noProfiles: "No encontramos perfiles de semilla.",
  },
  en: {
    seeds: "Seeds",
    profile: "Seed Profile",
    publicKnowledge: "Public seed knowledge",
    publicBody:
      "Canonical seed-to-seedling protocols with visible evidence and unresolved states preserved.",
    publicProfile: "Public profile",
    identities: "seed profiles",
    familyUnknown: "Family not established by the current profile",
    plantCare: "Mature plant care",
    seedProfile: "SEED PROFILE",
    visitor: "Visitor",
    myGarden: "My Garden",
    publicInventory: "Public knowledge",
    privateBoundary: "My inventory",
    privateTitle: "Your packets appear only in My Garden",
    privateBody:
      "This public profile preserves germination knowledge. Packets, lots, stock, and personal sowings require the authorized private context.",
    accessRequired: "Access required",
    fromSeed: "From seed to seedling",
    protocol: "Germination protocol",
    steps: "steps",
    protocolBody:
      "A phase-ordered timeline. Mature-plant management—pruning, harvest, and flowering—lives in the plant profile.",
    references: "References",
    officialSources: "Sources for this profile",
    sourceBacked: "Source-backed",
    gardenAdaptation: "Garden adaptation",
    needsValidation: "Needs validation",
    confidence: "Confidence",
    notEstablished: "Not established",
    noSources: "No resolved source links are available for this block.",
    noProfiles: "No seed profiles found.",
  },
} as const;

function localizedName(profile: SeedProfileViewModel, language: SeedProfileLanguage) {
  return language === "es" ? profile.spanishName : profile.name;
}

function statusLabel(
  evidenceType: "source_backed" | "garden_adaptation" | "needs_validation",
  language: SeedProfileLanguage,
) {
  const labels = copy[language];
  return evidenceType === "source_backed"
    ? labels.sourceBacked
    : evidenceType === "garden_adaptation"
      ? labels.gardenAdaptation
      : labels.needsValidation;
}

function StatusBadge({
  evidenceType,
  confidence,
  language,
}: {
  evidenceType: "source_backed" | "garden_adaptation" | "needs_validation";
  confidence: string;
  language: SeedProfileLanguage;
}) {
  const label = statusLabel(evidenceType, language);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold",
        evidenceType === "source_backed" && "bg-secondary text-secondary-foreground",
        evidenceType === "garden_adaptation" && "bg-accent/20 text-accent-foreground",
        evidenceType === "needs_validation" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          evidenceType === "source_backed" && "bg-primary",
          evidenceType === "garden_adaptation" && "bg-accent",
          evidenceType === "needs_validation" && "bg-muted-foreground",
        )}
      />
      {label} · {copy[language].confidence}: {confidence}
    </span>
  );
}

function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-baseline gap-1 text-xs font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="size-3 shrink-0 self-center" />
    </a>
  );
}

function StepAccordion({
  step,
  language,
  defaultOpen,
}: {
  step: SeedStepViewModel;
  language: SeedProfileLanguage;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const labels = copy[language];

  return (
    <article className={cn("glass-card overflow-hidden", open && "bg-card")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 text-xl leading-none" aria-hidden="true">
          {step.icon}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold leading-tight">
            {step.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{step.subtitle}</span>
        </span>
        {open ? (
          <Minus aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <Plus aria-hidden="true" className="size-4 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <p className="text-sm leading-7">{step.body}</p>
          {step.bullets.length ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7">
              {step.bullets.map((bullet, index) => (
                <li key={`${bullet.text}-${index}`}>
                  <span>{bullet.text}</span>
                  <span className="ml-2 inline-flex align-middle">
                    <StatusBadge
                      evidenceType={bullet.evidenceType}
                      confidence={bullet.confidence}
                      language={language}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge
              evidenceType={
                step.backing === "source"
                  ? "source_backed"
                  : step.backing === "garden"
                    ? "garden_adaptation"
                    : "needs_validation"
              }
              confidence={step.confidence}
              language={language}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            {step.sources.length ? (
              step.sources.map((source) => (
                <p key={source.id}>
                  <SourceLink label={source.label} url={source.url} />
                </p>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">{labels.noSources}</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ModeSwitch({
  mode,
  language,
  onChange,
}: {
  mode: "guest" | "member";
  language: SeedProfileLanguage;
  onChange: (mode: "guest" | "member") => void;
}) {
  const labels = copy[language];
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/70 p-1">
      {(
        [
          ["guest", labels.visitor, Eye],
          ["member", labels.myGarden, User],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={mode === value}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function PrivateInventoryNotice({
  profile,
  language,
  onPlantSelect,
}: {
  profile: SeedProfileViewModel;
  language: SeedProfileLanguage;
  onPlantSelect?: ((plantId: string) => void) | undefined;
}) {
  const labels = copy[language];
  return (
    <section className="glass-panel p-5 sm:p-6">
      <p className="eyebrow text-[10px]">{labels.privateBoundary}</p>
      <div className="mt-1 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary">
          <Package aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight">{labels.privateTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{labels.privateBody}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {labels.accessRequired}
            </span>
            {onPlantSelect ? (
              <button type="button" onClick={() => onPlantSelect(profile.plantIdentityId)} className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary">
                {labels.plantCare}
              </button>
            ) : (
              <a href={profile.plantHref} className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary">
                {labels.plantCare}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicInventoryNotice({
  profile,
  language,
  onPlantSelect,
}: {
  profile: SeedProfileViewModel;
  language: SeedProfileLanguage;
  onPlantSelect?: ((plantId: string) => void) | undefined;
}) {
  const labels = copy[language];
  return (
    <section className="glass-panel p-5 sm:p-6">
      <p className="eyebrow text-[10px]">{labels.publicInventory}</p>
      <div className="mt-1 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary">
          <Sprout aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight">
            {localizedName(profile, language)}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {language === "es"
              ? "Esta ficha pública describe cómo pasar de esta semilla a una plántula establecida. No muestra propiedad ni inventario personal."
              : "This public profile describes how to move from this seed to an established seedling. It does not show ownership or personal inventory."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {labels.publicProfile}
            </span>
            {onPlantSelect ? (
              <button type="button" onClick={() => onPlantSelect(profile.plantIdentityId)} className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary">
                {labels.plantCare}
                <ArrowUpRight aria-hidden="true" className="ml-2 size-4" />
              </button>
            ) : (
              <a href={profile.plantHref} className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary">
                {labels.plantCare}
                <ArrowUpRight aria-hidden="true" className="ml-2 size-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SeedLibraryView({ language, onSeedSelect }: { language: SeedProfileLanguage; onSeedSelect?: ((id: string) => void) | undefined }) {
  const profiles = buildSeedLibraryCards(language);
  const labels = copy[language];
  return (
    <section className="animate-rise py-6">
      <div className="glass-panel p-6 sm:p-8">
        <p className="eyebrow">Gardenpedia</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{labels.publicKnowledge}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {labels.publicBody}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="glass-soft px-3 py-1.5">
            {profiles.length} {labels.identities}
          </span>
          <span className="glass-soft px-3 py-1.5">{labels.publicProfile}</span>
          <span className="glass-soft px-3 py-1.5">Garden X public</span>
        </div>
      </div>
      {profiles.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="glass-card group">
              <button type="button" onClick={() => onSeedSelect?.(profile.id)} className="block w-full p-5 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {profile.emoji}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                    {labels.publicProfile}
                  </span>
                </div>
                <p className="mt-5 text-[11px] font-semibold text-accent">
                  {language === "es" ? profile.spanishName : profile.name}
                </p>
                <h3 className="mt-1 min-h-12 font-display text-lg font-semibold leading-tight">
                  {language === "es" ? profile.name : profile.spanishName}
                </h3>
                <p className="mt-1 truncate text-xs italic text-muted-foreground">
                  {profile.scientificName || labels.notEstablished}
                </p>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {profile.summary}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="font-semibold">
                    {profile.quickFactCount} {language === "es" ? "métricas" : "facts"} ·{" "}
                    {profile.sourceCount} {language === "es" ? "fuentes" : "sources"}
                  </span>
                  <ArrowUpRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel mt-5 grid min-h-48 place-items-center p-8 text-center text-sm text-muted-foreground">
          {labels.noProfiles}
        </div>
      )}
    </section>
  );
}

export function SeedProfilePage({
  profile,
  language,
  onLanguageChange,
  onBack,
  onPlantSelect,
}: {
  profile: SeedProfileViewModel;
  language: SeedProfileLanguage;
  onLanguageChange: (language: SeedProfileLanguage) => void;
  onBack?: (() => void) | undefined;
  onPlantSelect?: ((plantId: string) => void) | undefined;
}) {
  const [mode, setMode] = useState<"guest" | "member">("guest");
  const labels = copy[language];
  const name = localizedName(profile, language);
  return (
    <main className="garden-stage min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1320px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
          {onBack ? (
            <button type="button" onClick={onBack} className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold transition-colors hover:bg-secondary">
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              <span className="hidden sm:inline">{labels.seeds}</span>
            </button>
          ) : (
            <a href="/gardenpedia/" className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold transition-colors hover:bg-secondary">
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              <span className="hidden sm:inline">{labels.seeds}</span>
            </a>
          )}
          <div className="min-w-0">
            <p className="eyebrow truncate text-[10px]">Gardenpedia · {labels.profile}</p>
            <p className="truncate font-display text-sm font-bold leading-tight sm:text-base">
              {name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 rounded-full border border-border bg-background/70 p-1"
              aria-label="Language"
            >
              {(["es", "en"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onLanguageChange(value)}
                  aria-pressed={language === value}
                  className={cn(
                    "flex h-8 items-center rounded-full px-2.5 text-[10px] font-bold transition-colors",
                    language === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
            <ModeSwitch mode={mode} language={language} onChange={setMode} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="animate-rise grid gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
            <section className="glass-panel p-5 sm:p-7 lg:sticky lg:top-24">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                <span className="shrink-0 text-4xl leading-none" aria-hidden="true">
                  {profile.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-accent">
                    {language === "es" ? profile.spanishName : profile.name}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                    {profile.family || labels.familyUnknown}
                  </span>
                </div>
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
                {name}
              </h1>
              <p className="mt-2 text-sm italic text-muted-foreground">
                {profile.scientificName || labels.notEstablished}
              </p>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{profile.summary}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {profile.metrics.map((metric) => (
                  <div key={metric.key} className="glass-soft p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold leading-tight">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      {metric.note}
                    </p>
                    <span className="mt-2 block text-[10px] font-semibold text-muted-foreground">
                      {statusLabel(metric.evidenceType, language)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <p className="eyebrow text-[10px]">{labels.seedProfile}</p>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {[
                    [profile.evidence.sourceBacked, labels.sourceBacked],
                    [profile.evidence.gardenAdaptation, labels.gardenAdaptation],
                    [profile.evidence.needsValidation, labels.needsValidation],
                  ].map(([value, label]) => (
                    <div key={label} className="glass-soft p-3">
                      <p className="font-display text-lg font-bold leading-tight">{value}</p>
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8">
            {mode === "member" ? (
              <PrivateInventoryNotice profile={profile} language={language} onPlantSelect={onPlantSelect} />
            ) : (
              <PublicInventoryNotice profile={profile} language={language} onPlantSelect={onPlantSelect} />
            )}
            <section>
              <p className="eyebrow text-[10px]">{labels.fromSeed}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                {labels.protocol} · {profile.protocol.length} {labels.steps}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {labels.protocolBody}
              </p>
              <div className="mt-4 space-y-3">
                {profile.protocol.map((step, index) => (
                  <StepAccordion
                    key={step.id}
                    step={step}
                    language={language}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            </section>

            <section className="glass-panel p-5 sm:p-6">
              <p className="eyebrow text-[10px]">{labels.references}</p>
              <h2 className="mt-1 font-display text-xl font-semibold">{labels.officialSources}</h2>
              <div className="mt-4 space-y-2">
                {profile.sources.length ? (
                  profile.sources.map((source) => (
                    <p key={source.id}>
                      <SourceLink label={source.label} url={source.url} />
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{labels.noSources}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
