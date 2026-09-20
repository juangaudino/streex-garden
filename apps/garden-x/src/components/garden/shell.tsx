import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sprout, CheckCircle2, Sparkles, Library, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useGarden } from "@/lib/garden-store";
import { ui } from "@/lib/ui-copy";

const nav = [
  { to: "/", en: "Home", es: "Inicio", icon: Home },
  { to: "/gardens", en: "Gardens", es: "Jardines", icon: Sprout },
  { to: "/care", en: "Care", es: "Cuidado", icon: CheckCircle2 },
  { to: "/garden-ai", en: "Garden AI", es: "Garden AI", icon: Sparkles },
  { to: "/library", en: "Library", es: "Biblioteca", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { language, profile } = useGarden();

  return (
    <div className="min-h-screen lg:flex">
      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/70 bg-sidebar/60 px-5 py-8 lg:flex">
        <Link to="/" className="mb-10 block">
          <span className="eyebrow">Garden</span>
          <span className="mt-1 block font-display text-2xl leading-none">Garden X</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                 <span className="truncate">{item[language]}</span>
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto text-xs leading-relaxed text-muted-foreground">
          {ui(language, "sourceStatement")}
        </p>
        <Link to="/settings" className={cn("mt-5 flex items-center gap-3 border-t border-border/70 pt-5 text-sm transition-colors", pathname === "/settings" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-display">{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GX"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate">{profile.signedIn ? profile.name : ui(language, "yourGardenX")}</span><span className="block text-xs text-muted-foreground">{ui(language, "settings")}</span></span>
          <Settings className="h-4 w-4" />
        </Link>
      </aside>

      <main className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</main>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] text-[0.65rem] transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2 : 1.6} />
                 <span className="truncate">{item[language]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-5 pt-9 pb-6 sm:px-8 lg:px-12">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1.5 truncate font-display text-[1.75rem] leading-tight sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
