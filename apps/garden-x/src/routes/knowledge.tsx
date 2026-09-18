import { createFileRoute } from "@tanstack/react-router";
import { knowledge } from "@/lib/garden-store";
import { PageHeader } from "@/components/garden/shell";
import { ProvenanceTag } from "@/components/garden/atoms";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "Plant reference — Garden X" },
      {
        name: "description",
        content:
          "A small deterministic reference catalog: germination, light, temperature, pH, EC, spacing, pruning, harvest and common problems.",
      },
      { property: "og:title", content: "Plant reference — Garden X" },
      { property: "og:description", content: "Deterministic species reference: light, pH, EC, pruning, harvest and problems." },
    ],
  }),
  component: Knowledge,
});

function Knowledge() {
  return (
    <div className="rise pb-16">
      <PageHeader
        eyebrow="Reference"
        title="Structured plant knowledge"
        subtitle="Fixed reference data for the species in your gardens. It is never rewritten by a photo or an analysis."
      />

      <div className="px-5 sm:px-8 lg:px-12">
        <ProvenanceTag kind="recorded" />
      </div>

      <div className="mt-5 grid gap-5 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
        {knowledge.map((k) => (
          <article key={k.id} className="surface p-6">
            <h2 className="font-display text-2xl">{k.common}</h2>
            <p className="text-sm italic text-muted-foreground">{k.scientific}</p>
            <p className="mt-1 text-xs text-muted-foreground">Variety reference: {k.variety}</p>

            <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Germination", k.germinationDays],
                ["Light", k.light],
                ["Temperature", k.temperature],
                ["pH", k.ph],
                ...(k.ec ? [["EC", k.ec]] : []),
                ["Spacing", k.spacing],
                ["Pruning", k.pruning],
                ["Harvest", k.harvest],
                ["Cycle", k.cycle],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-0.5 text-sm">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Common problems</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {k.problems.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="eyebrow">Recommendations</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {k.recommendations.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}