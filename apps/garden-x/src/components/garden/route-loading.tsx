import { preferredLanguage, ui } from "@/lib/ui-copy";

export function RouteLoading({ label }: { label?: string }) {
  const resolvedLabel = label ?? ui(preferredLanguage(), "loadingGarden");
  return (
    <main className="grid min-h-[50vh] place-items-center bg-background px-5">
      <p className="breathe font-display text-xl text-primary">{resolvedLabel}</p>
    </main>
  );
}
