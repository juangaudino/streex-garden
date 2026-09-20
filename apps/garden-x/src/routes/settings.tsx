import { createFileRoute } from "@tanstack/react-router";
import { Globe2, LogIn, LogOut, Moon, Ruler, Sun, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useGarden } from "@/lib/garden-store";
import { PageHeader } from "@/components/garden/shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabaseClient, hasSupabaseConfiguration } from "@/lib/supabase";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — Garden X" },
    { name: "description", content: "Manage your Garden X profile, language, appearance, and units." },
    { property: "og:title", content: "Settings — Garden X" },
    { property: "og:description", content: "Personal Garden X account and app preferences." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SettingsPage,
});

function SettingsPage() {
  const store = useGarden();
  const language = store.language;
  const initials = store.profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GX";
  return <div className="rise pb-20"><PageHeader eyebrow={language === "es" ? "Tu Garden X" : "Your Garden X"} title={ui(language, "settings")} subtitle={language === "es" ? "Algunas preferencias personales para la forma en que se siente y se lee tu jardín." : "A few personal choices for how your garden feels and reads."} />
    <div className="mx-auto grid max-w-3xl gap-8 px-5 sm:px-8 lg:px-12">
      <SettingsSection icon={UserRound} title={language === "es" ? "Cuenta" : "Account"}>
        <div className="flex items-center gap-4"><Avatar className="h-12 w-12"><AvatarFallback className="bg-accent font-display text-lg">{initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1">{store.profile.signedIn ? <><input aria-label="Profile name" className="w-full bg-transparent font-medium outline-none" value={store.profile.name} onChange={(event) => store.updateProfile({ name: event.target.value })} /><p className="truncate text-xs text-muted-foreground">{store.profile.email}</p></> : <><p className="font-medium">Your garden, on this device</p><p className="text-xs text-muted-foreground">Sign in is simulated in this prototype.</p></>}</div><Button variant="outline" className="rounded-full" onClick={() => {
          if (store.profile.signedIn && hasSupabaseConfiguration()) { void getSupabaseClient().auth.signOut(); return; }
          store.updateProfile({ signedIn: !store.profile.signedIn });
        }}>{store.profile.signedIn ? <><LogOut /> Sign out</> : <><LogIn /> Sign in</>}</Button></div>
      </SettingsSection>
      <SettingsSection icon={Globe2} title={language === "es" ? "Idioma" : "Language"}><Segmented options={[{ value: "en", label: "English" }, { value: "es", label: "Español" }]} value={store.language} onChange={store.setLanguage} /></SettingsSection>
      <SettingsSection icon={Moon} title={language === "es" ? "Apariencia" : "Appearance"}><Segmented options={[{ value: "light", label: language === "es" ? "Claro" : "Light", icon: Sun }, { value: "dark", label: language === "es" ? "Oscuro" : "Dark", icon: Moon }, { value: "system", label: language === "es" ? "Sistema" : "System" }]} value={store.appearance} onChange={store.setAppearance} /></SettingsSection>
      <SettingsSection icon={Ruler} title={language === "es" ? "Unidades" : "Units"}>
        <div className="grid gap-5 sm:grid-cols-2"><div><p className="mb-2 text-xs text-muted-foreground">{language === "es" ? "Mediciones" : "Measurements"}</p><Segmented options={[{ value: "metric", label: language === "es" ? "Métrico" : "Metric" }, { value: "imperial", label: language === "es" ? "Imperial" : "Imperial" }]} value={store.measurementSystem} onChange={store.setMeasurementSystem} /></div><div><p className="mb-2 text-xs text-muted-foreground">{language === "es" ? "Temperatura" : "Temperature"}</p><Segmented options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]} value={store.temperatureUnit} onChange={store.setTemperatureUnit} /></div></div>
      </SettingsSection>
    </div>
  </div>;
}

function SettingsSection({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: ReactNode }) {
  return <section><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="font-display text-xl">{title}</h2></div><div className="surface p-5 sm:p-6">{children}</div></section>;
}

function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string; icon?: typeof Sun }>; value: T; onChange: (value: T) => void }) {
  return <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-secondary p-1">{options.map((option) => <Button type="button" variant="ghost" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("h-9 rounded-lg px-2", value === option.value ? "bg-card shadow-soft" : "text-muted-foreground")}>{option.icon ? <option.icon /> : null}{option.label}</Button>)}</div>;
}
