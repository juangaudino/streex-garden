import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Download, ExternalLink, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseClient, hasSupabaseConfiguration } from "@/lib/supabase";
import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import { canonicalMachineModel } from "./donor/machine-profile-adapter";
import { SeedProfilePage } from "./donor/seed-profile";
import { seedProfileForEntry } from "./donor/seed-profile-adapter";
import { findCanonicalEntry } from "./donor/canonical-adapter";
import type { GardenpediaLanguage } from "./donor/explore";

export type GardenpediaPrivateView = "my-plants" | "my-seeds" | "my-machines";

type SessionState = {
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
};

type SeedPackage = {
  id: string;
  libraryPlantId: string | null;
  seedName: string;
  brand: string | null;
  packageStatus: "opened" | "unopened" | "unknown";
  quantityLevel: "full" | "high" | "medium" | "low" | "almost_empty" | "unknown";
  storageLocation: string | null;
  purchaseDate: string | null;
  purchaseYear: string | null;
  germinationTestDate: string | null;
  germinationResultPct: number | null;
  notes: string | null;
  archived: boolean;
};

type MyPlant = {
  id: string;
  name: string;
  commonName: string;
  scientificName: string | null;
  cultivar: string | null;
  referenceKey: string | null;
  libraryPlantId: string | null;
  gardenName: string;
  cycleId: string | null;
  cycleState: string | null;
  plantedOn: string | null;
  positionNumber: number | null;
  journalPath: string;
};

type MyMachine = {
  id: string;
  name: string;
  gardenId: string;
  gardenName: string;
  gardenKind: string | null;
  positions: number | null;
  systemDefinitionKey: string | null;
  modelId: string | null;
  status: string | null;
};

type CuratorProposal = {
  id: string;
  contractName?: string;
  contractVersion?: string;
  candidateIdentity?: Record<string, unknown>;
  proposedData?: Record<string, unknown>;
  evidence?: unknown;
  confidenceStatus?: Record<string, unknown>;
  reviewStatus?: string;
  publicationStatus?: string;
  publicationReference?: string | null;
  publicationVersion?: string | null;
  publicationError?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
};

type CuratorRequest = {
  id: string;
  ownerId?: string;
  requestedText: string;
  status: string;
  createdAt: string;
  proposals: CuratorProposal[];
};

const COPY = {
  es: {
    myGarden: "Mi jardín",
    myPlants: "Mis plantas",
    mySeeds: "Mis semillas",
    myMachines: "Mis máquinas",
    back: "Explorar Gardenpedia",
    signIn: "Inicia sesión para ver tus datos privados de Garden X.",
    loading: "Cargando…",
    unavailable: "No se pudo cargar esta superficie. Inténtalo de nuevo.",
    emptyPlants: "Todavía no hay plantas activas asociadas a este usuario.",
    emptySeeds: "Todavía no hay paquetes de semillas.",
    emptyMachines: "Todavía no hay sistemas asociados a este usuario.",
    locations: "Ubicaciones reales",
    journal: "Abrir Journal",
    package: "Paquete",
    newPackage: "Añadir paquete",
    edit: "Editar",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar este paquete? Esta acción no se puede deshacer.",
    seedName: "Nombre de semilla",
    brand: "Marca",
    identity: "Identidad Gardenpedia",
    unresolved: "Sin identidad vinculada",
    status: "Estado del paquete",
    quantity: "Cantidad aproximada",
    storage: "Ubicación de almacenamiento",
    purchaseDate: "Fecha de compra",
    notes: "Notas privadas",
    opened: "Abierto",
    unopened: "Sin abrir",
    unknown: "Desconocido",
    full: "Completo",
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
    almostEmpty: "Casi vacío",
    guide: "Guía pública de semilla",
    guideUnavailable: "Todavía no hay un Seed Profile V0 para esta identidad.",
    model: "Modelo Gardenpedia",
    custom: "Sistema personalizado",
    positions: "posiciones",
    admin: "Curator / Master",
    adminTitle: "Gardenpedia · Curator / Master",
    adminIntro:
      "Revisa propuestas con la autorización editorial existente. Aprobar no publica automáticamente.",
    authRequired: "Se requiere una sesión autenticada.",
    curatorRequired: "Esta cuenta no tiene permisos de curator/master.",
    refresh: "Actualizar",
    research: "Investigar",
    review: "Revisar",
    approve: "Aprobar",
    reject: "Rechazar",
    revise: "Devolver para revisión",
    export: "Exportar propuesta",
    publication: "Publicación",
    publicationReference: "Referencia de publicación",
    markStarted: "Marcar publicación iniciada",
    markFailed: "Marcar publicación fallida",
    reviewNote: "Nota editorial",
    noRequests: "No hay solicitudes pendientes.",
    proposal: "Propuesta",
    request: "Solicitud",
  },
  en: {
    myGarden: "My Garden",
    myPlants: "My Plants",
    mySeeds: "My Seeds",
    myMachines: "My Machines",
    back: "Explore Gardenpedia",
    signIn: "Sign in to view your private Garden X data.",
    loading: "Loading…",
    unavailable: "This surface could not be loaded. Try again.",
    emptyPlants: "No active plants are associated with this user yet.",
    emptySeeds: "No seed packages yet.",
    emptyMachines: "No systems are associated with this user yet.",
    locations: "Real locations",
    journal: "Open Journal",
    package: "Package",
    newPackage: "Add package",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirmDelete: "Delete this package? This cannot be undone.",
    seedName: "Seed name",
    brand: "Brand",
    identity: "Gardenpedia identity",
    unresolved: "No linked identity",
    status: "Package status",
    quantity: "Approximate quantity",
    storage: "Storage location",
    purchaseDate: "Purchase date",
    notes: "Private notes",
    opened: "Opened",
    unopened: "Unopened",
    unknown: "Unknown",
    full: "Full",
    high: "High",
    medium: "Medium",
    low: "Low",
    almostEmpty: "Almost empty",
    guide: "Public seed guide",
    guideUnavailable: "There is no Seed Profile V0 for this identity yet.",
    model: "Gardenpedia model",
    custom: "Custom system",
    positions: "positions",
    admin: "Curator / Master",
    adminTitle: "Gardenpedia · Curator / Master",
    adminIntro:
      "Review proposals using the existing editorial authorization. Approval does not publish automatically.",
    authRequired: "An authenticated session is required.",
    curatorRequired: "This account does not have curator/master permissions.",
    refresh: "Refresh",
    research: "Research",
    review: "Review",
    approve: "Approve",
    reject: "Reject",
    revise: "Return for revision",
    export: "Export proposal",
    publication: "Publication",
    publicationReference: "Publication reference",
    markStarted: "Mark publication started",
    markFailed: "Mark publication failed",
    reviewNote: "Editorial note",
    noRequests: "No pending requests.",
    proposal: "Proposal",
    request: "Request",
  },
} as const;

function copy(language: GardenpediaLanguage) {
  return COPY[language];
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function useGardenpediaAuth(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: hasSupabaseConfiguration(),
    signedIn: false,
    userId: null,
  });

  useEffect(() => {
    if (!hasSupabaseConfiguration()) {
      setState({ loading: false, signedIn: false, userId: null });
      return;
    }
    const client = getSupabaseClient();
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({
        loading: false,
        signedIn: Boolean(data.session),
        userId: data.session?.user.id ?? null,
      });
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active)
        setState({ loading: false, signedIn: Boolean(session), userId: session?.user.id ?? null });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

function PrivateGate({
  language,
  children,
}: {
  language: GardenpediaLanguage;
  children: ReactNode;
}) {
  const auth = useGardenpediaAuth();
  const labels = copy(language);
  if (auth.loading) return <StatusCard text={labels.loading} />;
  if (!auth.signedIn) return <StatusCard text={labels.signIn} />;
  return <>{children}</>;
}

function StatusCard({ text }: { text: string }) {
  return (
    <div className="glass-panel mt-5 grid min-h-40 place-items-center p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function MyGardenSurface({
  section,
  language,
  onSectionChange,
  onBack,
}: {
  section: GardenpediaPrivateView;
  language: GardenpediaLanguage;
  onSectionChange: (section: GardenpediaPrivateView) => void;
  onBack: () => void;
}) {
  const labels = copy(language);
  return (
    <PrivateGate language={language}>
      <section className="animate-rise mt-5 space-y-5" aria-labelledby="my-garden-title">
        <div className="glass-panel flex flex-col gap-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Gardenpedia · {labels.myGarden}</p>
              <h2 id="my-garden-title" className="mt-1 font-display text-2xl font-bold">
                {labels.myGarden}
              </h2>
            </div>
            <Button type="button" variant="outline" onClick={onBack} className="rounded-full">
              <ArrowLeft className="mr-2 size-4" /> {labels.back}
            </Button>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label={labels.myGarden}>
            {(["my-plants", "my-seeds", "my-machines"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                variant={section === item ? "default" : "outline"}
                onClick={() => onSectionChange(item)}
                className="rounded-full"
              >
                {item === "my-plants"
                  ? labels.myPlants
                  : item === "my-seeds"
                    ? labels.mySeeds
                    : labels.myMachines}
              </Button>
            ))}
          </nav>
        </div>
        {section === "my-plants" ? <MyPlants language={language} /> : null}
        {section === "my-seeds" ? <MySeeds language={language} /> : null}
        {section === "my-machines" ? <MyMachines language={language} /> : null}
      </section>
    </PrivateGate>
  );
}

function MyPlants({ language }: { language: GardenpediaLanguage }) {
  const labels = copy(language);
  const [plants, setPlants] = useState<MyPlant[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void rpc<{ plants?: MyPlant[] }>("gardenpedia_get_my_plants")
      .then((result) => {
        if (active) {
          setPlants(result.plants ?? []);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; identity: MyPlant; locations: MyPlant[] }>();
    for (const plant of plants) {
      const key =
        plant.libraryPlantId || plant.referenceKey || `unresolved:${plant.commonName || plant.id}`;
      const current = groups.get(key);
      if (current) current.locations.push(plant);
      else groups.set(key, { key, identity: plant, locations: [plant] });
    }
    return [...groups.values()];
  }, [plants]);

  if (state === "loading") return <StatusCard text={labels.loading} />;
  if (state === "error") return <StatusCard text={labels.unavailable} />;
  if (!grouped.length) return <StatusCard text={labels.emptyPlants} />;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {grouped.map(({ key, identity, locations }) => {
        const entry = findCanonicalEntry(identity.libraryPlantId || identity.referenceKey || "");
        const name = entry
          ? language === "es"
            ? entry.spanishName || entry.commonName
            : entry.commonName
          : identity.name || identity.commonName;
        const secondary = entry
          ? language === "es"
            ? entry.commonName
            : entry.spanishName
          : identity.scientificName;
        return (
          <article key={key} className="glass-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{entry ? "Gardenpedia" : labels.unresolved}</p>
                <h3 className="mt-1 font-display text-xl font-semibold">{name}</h3>
                <p className="mt-1 text-xs italic text-muted-foreground">{secondary}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                {locations.length}
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-muted-foreground">{labels.locations}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {locations.map((location) => (
                <a
                  key={location.id}
                  href={location.journalPath}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  {location.gardenName} · P{location.positionNumber ?? "—"}{" "}
                  <ExternalLink className="ml-1 inline size-3" />
                </a>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const emptyPackage: Omit<SeedPackage, "id"> = {
  libraryPlantId: null,
  seedName: "",
  brand: "",
  packageStatus: "unknown",
  quantityLevel: "unknown",
  storageLocation: "",
  purchaseDate: "",
  purchaseYear: "",
  germinationTestDate: "",
  germinationResultPct: null,
  notes: "",
  archived: false,
};

function MySeeds({ language }: { language: GardenpediaLanguage }) {
  const labels = copy(language);
  const [packages, setPackages] = useState<SeedPackage[]>([]);
  const [selected, setSelected] = useState<SeedPackage | null>(null);
  const [draft, setDraft] = useState<Omit<SeedPackage, "id">>(emptyPackage);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    void rpc<{ packages?: SeedPackage[] }>("garden_seed_packages_list")
      .then((result) => {
        setPackages(result.packages ?? []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const begin = (item?: SeedPackage) => {
    setSelected(item ?? null);
    setDraft(item ? { ...item } : { ...emptyPackage });
    setEditing(true);
    setMessage(null);
  };
  const save = async () => {
    if (!draft.seedName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await rpc("garden_seed_package_save", {
        p_package: selected ? { ...draft, id: selected.id } : draft,
      });
      setSelected(null);
      setDraft({ ...emptyPackage });
      setEditing(false);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unavailable);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: SeedPackage) => {
    if (!window.confirm(labels.confirmDelete)) return;
    try {
      await rpc("garden_seed_package_delete", { p_package_id: item.id });
      if (selected?.id === item.id) {
        setSelected(null);
        setEditing(false);
      }
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unavailable);
    }
  };

  if (state === "loading") return <StatusCard text={labels.loading} />;
  if (state === "error") return <StatusCard text={labels.unavailable} />;
  const profile = selected?.libraryPlantId
    ? seedProfileForEntry(selected.libraryPlantId, language)
    : null;
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" onClick={() => begin()} className="rounded-full">
          {labels.newPackage}
        </Button>
      </div>
      {editing || packages.length === 0 ? (
        <SeedPackageEditor
          draft={draft}
          selected={selected}
          language={language}
          labels={labels}
          saving={saving}
          message={message}
          onChange={setDraft}
          onSave={save}
          onCancel={() => {
            setSelected(null);
            setDraft({ ...emptyPackage });
            setEditing(false);
          }}
        />
      ) : null}
      {packages.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((item) => {
            const entry = item.libraryPlantId ? findCanonicalEntry(item.libraryPlantId) : null;
            return (
              <article key={item.id} className="glass-card p-5">
                <p className="eyebrow">
                  {entry
                    ? language === "es"
                      ? entry.spanishName || entry.commonName
                      : entry.commonName
                    : labels.unresolved}
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold">{item.seedName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.brand || labels.unknown} ·{" "}
                  {item.packageStatus === "opened"
                    ? labels.opened
                    : item.packageStatus === "unopened"
                      ? labels.unopened
                      : labels.unknown}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {labels.quantity}: {item.quantityLevel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => begin(item)}>
                    {labels.edit}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove(item)}>
                    <Trash2 className="mr-1 size-3.5" />
                    {labels.delete}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <StatusCard text={labels.emptySeeds} />
      )}
      {selected && profile ? (
        <section className="glass-panel overflow-hidden p-2 sm:p-4">
          <div className="px-3 pt-3">
            <p className="eyebrow">{labels.guide}</p>
          </div>
          <SeedProfilePage
            profile={profile}
            language={language}
            onLanguageChange={() => undefined}
          />
        </section>
      ) : null}
      {selected && !profile ? (
        <div className="glass-soft p-4 text-sm text-muted-foreground">
          {labels.guideUnavailable}
        </div>
      ) : null}
    </div>
  );
}

function SeedPackageEditor({
  draft,
  selected,
  language,
  labels,
  saving,
  message,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Omit<SeedPackage, "id">;
  selected: SeedPackage | null;
  language: GardenpediaLanguage;
  labels: (typeof COPY)[GardenpediaLanguage];
  saving: boolean;
  message: string | null;
  onChange: (draft: Omit<SeedPackage, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const field = (key: keyof Omit<SeedPackage, "id">, value: string | boolean | number | null) =>
    onChange({ ...draft, [key]: value } as Omit<SeedPackage, "id">);
  return (
    <section className="glass-panel p-5 sm:p-7">
      <p className="eyebrow">{labels.package}</p>
      <h3 className="mt-1 font-display text-xl font-semibold">
        {selected ? labels.edit : labels.newPackage}
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          {labels.seedName}
          <Input
            value={draft.seedName}
            onChange={(e) => field("seedName", e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-semibold">
          {labels.brand}
          <Input
            value={draft.brand ?? ""}
            onChange={(e) => field("brand", e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-semibold">
          {labels.identity}
          <select
            value={draft.libraryPlantId ?? ""}
            onChange={(e) => field("libraryPlantId", e.target.value || null)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{labels.unresolved}</option>
            {gardenLibraryManifest.entries.map((entry) => (
              <option key={entry.libraryPlantId} value={entry.libraryPlantId}>
                {language === "es" ? entry.spanishName || entry.commonName : entry.commonName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {labels.status}
          <select
            value={draft.packageStatus}
            onChange={(e) => field("packageStatus", e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="unknown">{labels.unknown}</option>
            <option value="opened">{labels.opened}</option>
            <option value="unopened">{labels.unopened}</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          {labels.quantity}
          <select
            value={draft.quantityLevel}
            onChange={(e) => field("quantityLevel", e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="unknown">{labels.unknown}</option>
            <option value="full">{labels.full}</option>
            <option value="high">{labels.high}</option>
            <option value="medium">{labels.medium}</option>
            <option value="low">{labels.low}</option>
            <option value="almost_empty">{labels.almostEmpty}</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          {labels.storage}
          <Input
            value={draft.storageLocation ?? ""}
            onChange={(e) => field("storageLocation", e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-semibold">
          {labels.purchaseDate}
          <Input
            type="date"
            value={draft.purchaseDate ?? ""}
            onChange={(e) => field("purchaseDate", e.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          {labels.notes}
          <textarea
            value={draft.notes ?? ""}
            onChange={(e) => field("notes", e.target.value)}
            className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
          />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onSave} disabled={saving || !draft.seedName.trim()}>
          {saving ? labels.loading : labels.save}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </section>
  );
}

function MyMachines({ language }: { language: GardenpediaLanguage }) {
  const labels = copy(language);
  const [machines, setMachines] = useState<MyMachine[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void rpc<{ instances?: MyMachine[] }>("gardenpedia_get_my_machines")
      .then((result) => {
        if (active) {
          setMachines(result.instances ?? []);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);
  if (state === "loading") return <StatusCard text={labels.loading} />;
  if (state === "error") return <StatusCard text={labels.unavailable} />;
  if (!machines.length) return <StatusCard text={labels.emptyMachines} />;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {machines.map((machine) => {
        const model = machine.modelId ? canonicalMachineModel(machine.modelId) : null;
        return (
          <article key={machine.id} className="glass-card p-5">
            <p className="eyebrow">{model ? labels.model : labels.custom}</p>
            <h3 className="mt-1 font-display text-xl font-semibold">
              {machine.name || machine.gardenName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {machine.gardenName}
              {model ? ` · ${model.name}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-secondary px-3 py-1.5">
                {machine.positions ?? "—"} {labels.positions}
              </span>
              <span className="rounded-full border border-border px-3 py-1.5">
                {machine.status || labels.unknown}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function GardenpediaAdmin({ language }: { language: GardenpediaLanguage }) {
  const labels = copy(language);
  const auth = useGardenpediaAuth();
  const [isCurator, setIsCurator] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<CuratorRequest[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setState("loading");
    setMessage(null);
    try {
      const status = await rpc<{ isCurator?: boolean }>("gardenpedia_curator_status");
      setIsCurator(status.isCurator === true);
      if (status.isCurator) {
        const queue = await rpc<{ requests?: CuratorRequest[] }>("gardenpedia_curator_queue");
        setRequests(queue.requests ?? []);
      }
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : labels.unavailable);
    }
  }, [labels.unavailable]);
  useEffect(() => {
    if (!auth.loading && auth.signedIn) void load();
    else if (!auth.loading) setState("ready");
  }, [auth.loading, auth.signedIn, load]);
  const action = async (work: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await work();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unavailable);
    }
  };
  if (auth.loading || state === "loading")
    return (
      <AdminShell language={language}>
        <StatusCard text={labels.loading} />
      </AdminShell>
    );
  if (!auth.signedIn)
    return (
      <AdminShell language={language}>
        <StatusCard text={labels.authRequired} />
      </AdminShell>
    );
  if (state === "error")
    return (
      <AdminShell language={language}>
        <StatusCard text={message || labels.unavailable} />
      </AdminShell>
    );
  if (!isCurator)
    return (
      <AdminShell language={language}>
        <StatusCard text={labels.curatorRequired} />
      </AdminShell>
    );
  return (
    <AdminShell language={language}>
      <div className="glass-panel mt-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{labels.admin}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{labels.adminTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              {labels.adminIntro}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-4" />
            {labels.refresh}
          </Button>
        </div>
      </div>
      {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
      <div className="mt-5 space-y-4">
        {requests.length ? (
          requests.map((request) => (
            <AdminRequest
              key={request.id}
              request={request}
              language={language}
              onAction={action}
            />
          ))
        ) : (
          <StatusCard text={labels.noRequests} />
        )}
      </div>
    </AdminShell>
  );
}

function AdminShell({
  language,
  children,
}: {
  language: GardenpediaLanguage;
  children: ReactNode;
}) {
  const labels = copy(language);
  return (
    <main className="garden-stage min-h-screen text-foreground">
      <div className="garden-shell mx-auto max-w-[1320px] px-4 py-4 sm:px-6 sm:py-6">
        <header className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-7 text-accent" />
            <div>
              <p className="eyebrow">Gardenpedia</p>
              <h1 className="font-display text-xl font-bold">{labels.adminTitle}</h1>
            </div>
          </div>
          <a
            href="/gardenpedia/"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            {labels.back}
          </a>
        </header>
        {children}
      </div>
    </main>
  );
}

function AdminRequest({
  request,
  language,
  onAction,
}: {
  request: CuratorRequest;
  language: GardenpediaLanguage;
  onAction: (work: () => Promise<unknown>) => Promise<void>;
}) {
  const labels = copy(language);
  return (
    <article className="glass-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{labels.request}</p>
          <h3 className="mt-1 font-display text-xl font-semibold">{request.requestedText}</h3>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
          {request.status}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {request.proposals?.length ? (
          request.proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              request={request}
              proposal={proposal}
              language={language}
              onAction={onAction}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noRequests}</p>
        )}
      </div>
    </article>
  );
}

function ProposalCard({
  request,
  proposal,
  language,
  onAction,
}: {
  request: CuratorRequest;
  proposal: CuratorProposal;
  language: GardenpediaLanguage;
  onAction: (work: () => Promise<unknown>) => Promise<void>;
}) {
  const labels = copy(language);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const plant = (proposal.proposedData?.plant || {}) as Record<string, unknown>;
  const sources = Array.isArray(proposal.proposedData?.sources)
    ? (proposal.proposedData?.sources as Array<Record<string, unknown>>)
    : [];
  const exportBundle = async () => {
    const bundle = await rpc<unknown>("gardenpedia_export_publication_bundle", {
      p_proposal_id: proposal.id,
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gardenpedia-proposal-${proposal.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent">{labels.proposal}</p>
          <h4 className="mt-1 font-display text-lg font-semibold">
            {String(plant.name || proposal.candidateIdentity?.name || proposal.id)}
          </h4>
          <p className="text-xs text-muted-foreground">
            {proposal.reviewStatus || "—"} · {proposal.publicationStatus || "—"}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{sources.length} sources</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <strong>Scientific name:</strong> {String(plant.scientificName || "—")}
        </p>
        <p>
          <strong>Contract:</strong> {proposal.contractName || "—"} v
          {proposal.contractVersion || "—"}
        </p>
      </div>
      <label className="mt-4 block text-sm font-semibold">
        {labels.reviewNote}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void onAction(() =>
              rpc("gardenpedia_review_proposal", {
                p_proposal_id: proposal.id,
                p_decision: "revise",
                p_note: note || null,
              }),
            )
          }
        >
          {labels.revise}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            void onAction(() =>
              rpc("gardenpedia_approve_proposal", {
                p_proposal_id: proposal.id,
              }),
            )
          }
        >
          {labels.approve}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() =>
            void onAction(() =>
              rpc("gardenpedia_review_proposal", {
                p_proposal_id: proposal.id,
                p_decision: "reject",
                p_note: note || null,
              }),
            )
          }
        >
          {labels.reject}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onAction(exportBundle)}
        >
          <Download className="mr-1 size-3.5" />
          {labels.export}
        </Button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder={labels.publicationReference}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void onAction(() =>
              rpc("gardenpedia_mark_publication_started", {
                p_proposal_id: proposal.id,
                p_reference: reference,
              }),
            )
          }
        >
          {labels.markStarted}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void onAction(() =>
              rpc("gardenpedia_mark_publication_failed", {
                p_proposal_id: proposal.id,
                p_error: note || "Publication issue",
              }),
            )
          }
        >
          {labels.markFailed}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {labels.publication}: {proposal.publicationReference || "—"}
        {proposal.publicationError ? ` · ${proposal.publicationError}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            void onAction(() =>
              getSupabaseClient().functions.invoke("gardenpedia-research", {
                body: { requestId: request.id },
              }),
            )
          }
        >
          {labels.research}
        </Button>
      </div>
    </section>
  );
}
