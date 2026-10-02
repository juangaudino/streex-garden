import { ArrowLeft, Eye, User, Wrench } from "lucide-react";

import {
  canonicalMachineModel,
  type CanonicalMachineModel,
  type MachineProfileLanguage,
  publicMachineViewModel,
} from "./machine-profile-adapter";

const COPY = {
  es: {
    library: "Gardenpedia",
    profile: "Ficha de máquina",
    visitor: "Visitante",
    myGarden: "Mi jardín",
    publicModel: "Modelo público",
    publicModelIntro:
      "Conocimiento publicado del modelo. Las unidades físicas y sus layouts permanecen en el contexto privado de Garden X.",
    documentedFacts: "Especificaciones documentadas",
    model: "Modelo",
    maximumHeight: "Altura máxima documentada",
    maintenance: "Mantenimiento",
    maintenanceUnavailable:
      "No hay un protocolo público de mantenimiento representado para este modelo.",
    layout: "Distribución",
    layoutUnavailable:
      "La configuración de posiciones pertenece a una Instance Layout autorizada y no se inventa en el perfil público.",
    sources: "Fuentes",
    source: "Fuente del modelo",
    sourceBacked: "Respaldado por fuente",
    boundaryTitle: "Modelo ≠ unidad ≠ layout",
    boundaryBody:
      "Esta ficha describe el Machine Model. Una System Instance real y su Instance Layout solo aparecen en My Garden cuando existe contexto autorizado.",
    unavailable: "Ficha de máquina no disponible",
    back: "Máquinas",
    pending: "Pendiente / desconocido",
  },
  en: {
    library: "Gardenpedia",
    profile: "Machine Profile",
    visitor: "Visitor",
    myGarden: "My Garden",
    publicModel: "Public model",
    publicModelIntro:
      "Published model knowledge. Physical units and their layouts remain in Garden X private context.",
    documentedFacts: "Documented specifications",
    model: "Model",
    maximumHeight: "Maximum documented grow height",
    maintenance: "Maintenance",
    maintenanceUnavailable: "No public maintenance protocol is represented for this model.",
    layout: "Layout",
    layoutUnavailable:
      "Position configuration belongs to an authorized Instance Layout and is not invented in the public profile.",
    sources: "Sources",
    source: "Model source",
    sourceBacked: "Source-backed",
    boundaryTitle: "Model ≠ unit ≠ layout",
    boundaryBody:
      "This profile describes the Machine Model. A real System Instance and its Instance Layout appear in My Garden only when authorized context exists.",
    unavailable: "Machine profile unavailable",
    back: "Machines",
    pending: "Pending / unknown",
  },
} as const;

export function MachineProfilePage({
  modelId,
  language,
}: {
  modelId: string;
  language: MachineProfileLanguage;
}) {
  const model = canonicalMachineModel(modelId);
  if (!model) {
    return (
      <main className="garden-stage grid min-h-screen place-items-center p-6 text-foreground">
        <div className="glass-panel p-8 text-center">
          <p className="font-display text-xl font-semibold">{COPY[language].unavailable}</p>
          <a href="/gardenpedia" className="mt-4 inline-block text-sm text-accent">
            ← {COPY[language].back}
          </a>
        </div>
      </main>
    );
  }
  return <MachineSheet model={model} language={language} />;
}

function MachineSheet({
  model,
  language,
}: {
  model: CanonicalMachineModel;
  language: MachineProfileLanguage;
}) {
  const copy = COPY[language];
  const viewModel = publicMachineViewModel(model);
  return (
    <main className="garden-stage min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href="/gardenpedia"
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            {copy.back}
          </a>
          <div className="glass-soft flex rounded-full p-1 text-xs font-semibold">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-primary-foreground"
              aria-pressed="true"
            >
              <Eye className="size-3.5" /> {copy.visitor}
            </button>
            <button
              type="button"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground"
              aria-disabled="true"
              disabled
              title={copy.publicModelIntro}
            >
              <User className="size-3.5" /> {copy.myGarden}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
        <section className="glass-panel p-6 sm:p-8">
          <p className="eyebrow">
            Gardenpedia · {copy.profile} · {model.vendor}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{model.name}</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{model.modelNumber}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            {copy.publicModelIntro}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {copy.publicModel}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {copy.sourceBacked}
            </span>
          </div>
        </section>

        <section className="glass-soft rounded-2xl p-6">
          <p className="eyebrow text-[10px]">{copy.boundaryTitle}</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{copy.boundaryBody}</p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="glass-panel p-6">
            <p className="eyebrow text-[10px]">{copy.sourceBacked}</p>
            <h2 className="mt-1 font-display text-xl font-semibold">{copy.documentedFacts}</h2>
            <ul className="mt-4 divide-y divide-border">
              {viewModel.publicFacts.map((fact) => (
                <li key={fact.label} className="py-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {fact.label === "Model" ? copy.model : copy.maximumHeight}
                    </span>
                    <span className="text-right font-semibold">{fact.value}</span>
                  </div>
                  {fact.label !== "Model" ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {model.source.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-panel p-6">
            <p className="eyebrow text-[10px]">{copy.publicModel}</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold">
              <Wrench className="size-4 text-accent" /> {copy.maintenance}
            </h2>
            <div className="mt-4 rounded-xl border border-dashed border-border p-4">
              <span className="inline-flex rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                {copy.pending}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {copy.maintenanceUnavailable}
              </p>
            </div>
          </section>
        </div>

        <section className="glass-panel p-6">
          <p className="eyebrow text-[10px]">{copy.publicModel}</p>
          <h2 className="mt-1 font-display text-xl font-semibold">{copy.layout}</h2>
          <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
            {copy.layoutUnavailable}
          </div>
        </section>

        <section className="glass-panel p-6">
          <p className="eyebrow text-[10px]">{copy.sources}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <a
                href={model.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {model.source.title} · {model.source.publisher} ↗
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
