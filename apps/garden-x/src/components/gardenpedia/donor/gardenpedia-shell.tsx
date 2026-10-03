import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GardenpediaSurface =
  "library" | "seeds" | "machines" | "calculator" | "my-plants" | "my-seeds" | "my-machines";

export type GardenpediaLanguage = "en" | "es";

const COPY = {
  es: {
    gardenpedia: "Gardenpedia",
    byGardenX: "by Garden X",
    library: "Gardenpedia",
    seeds: "Semillas",
    machines: "Máquinas",
    calculator: "Calculadora",
    myGarden: "Mi jardín",
    sections: "Secciones",
    language: "Idioma",
  },
  en: {
    gardenpedia: "Gardenpedia",
    byGardenX: "by Garden X",
    library: "Gardenpedia",
    seeds: "Seeds",
    machines: "Machines",
    calculator: "Calculator",
    myGarden: "My Garden",
    sections: "Sections",
    language: "Language",
  },
} as const;

type GardenpediaShellProps = {
  activeView: GardenpediaSurface;
  language: GardenpediaLanguage;
  onLanguageChange: (language: GardenpediaLanguage) => void;
  onViewChange: (view: GardenpediaSurface) => void;
  showPrivateNavigation?: boolean;
  diagnosticOnly?: boolean;
  subtitle: string;
  children: ReactNode;
};

export function GardenpediaShell({
  activeView,
  language,
  onLanguageChange,
  onViewChange,
  showPrivateNavigation = false,
  diagnosticOnly = false,
  subtitle,
  children,
}: GardenpediaShellProps) {
  const copy = COPY[language];
  const destinations: Array<{ id: GardenpediaSurface; label: string }> = [
    { id: "library", label: copy.library },
    { id: "seeds", label: copy.seeds },
    { id: "machines", label: copy.machines },
    { id: "calculator", label: copy.calculator },
  ];

  if (!diagnosticOnly && showPrivateNavigation) {
    destinations.push({ id: "my-plants", label: copy.myGarden });
  }

  return (
    <main className="garden-stage min-h-screen min-w-0 max-w-full text-foreground">
      <div className="garden-shell mx-auto min-w-0 max-w-[1320px] px-3 py-3 sm:px-6 sm:py-6">
        <header className="glass-panel min-w-0 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <img
                src="/icons/garden-x-512.png"
                alt="Garden X"
                className="size-9 shrink-0 rounded-lg shadow-sm sm:size-10"
              />
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold leading-none sm:text-xl">
                  {copy.gardenpedia}
                  <span className="hidden sm:inline"> {copy.byGardenX}</span>
                </h1>
                <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{subtitle}</p>
              </div>
            </div>
            <div
              className="glass-soft flex shrink-0 items-center p-1 text-xs font-semibold"
              aria-label={copy.language}
            >
              {(["es", "en"] as const).map((option) => {
                const active = language === option;
                return (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    aria-pressed={active}
                    onClick={() => onLanguageChange(option)}
                    className={cn(
                      "h-8 min-w-9 rounded-md px-2.5 text-xs",
                      active
                        ? "border border-primary/50 font-bold shadow-sm"
                        : "border border-transparent text-muted-foreground",
                    )}
                  >
                    {option.toUpperCase()}
                  </Button>
                );
              })}
            </div>
          </div>

          <nav
            aria-label={copy.sections}
            className="glass-soft mt-3 grid min-w-0 grid-cols-3 gap-1 p-1 sm:flex sm:flex-wrap"
          >
            {destinations.map((destination) => {
              const active =
                activeView === destination.id ||
                (destination.id === "my-plants" &&
                  (activeView === "my-plants" ||
                    activeView === "my-seeds" ||
                    activeView === "my-machines"));
              return (
                <Button
                  key={destination.id}
                  type="button"
                  variant={active ? "default" : "ghost"}
                  size="sm"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onViewChange(destination.id)}
                  className={cn(
                    "min-w-0 rounded-md px-2 text-xs font-medium sm:w-auto sm:px-3 sm:text-sm",
                    active
                      ? "border border-primary/50 font-bold shadow-sm"
                      : "border border-transparent",
                  )}
                >
                  <span className="truncate">{destination.label}</span>
                </Button>
              );
            })}
          </nav>
        </header>

        {children}
      </div>
    </main>
  );
}
