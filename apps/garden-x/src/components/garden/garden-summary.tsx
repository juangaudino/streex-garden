import { cn } from "@/lib/utils";
import { summaryUpdatedLabel, type GardenSummaryResult } from "@/lib/garden-summaries";
import { ui, type UiLanguage } from "@/lib/ui-copy";

export function GardenSummaryCard({
  summary,
  language,
  className,
}: {
  summary: GardenSummaryResult | null;
  language: UiLanguage;
  className?: string;
}) {
  if (!summary) return null;
  const updated = summaryUpdatedLabel(summary.generatedAt, language);
  return (
    <article className={cn("surface px-5 py-5 sm:px-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">{ui(language, "gardenSummary")}</p>
        {updated ? <p className="text-xs text-muted-foreground">{updated}</p> : null}
      </div>
      <p className="mt-3 max-w-3xl font-display text-xl leading-snug text-foreground sm:text-2xl">
        {summary.summaryText}
      </p>
    </article>
  );
}
