import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Sprout } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/garden/shell";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Garden Library — Garden X" },
      {
        name: "description",
        content: "The future home of Garden X plant, seed, and growing-system reference.",
      },
      { property: "og:title", content: "Garden Library — Garden X" },
      {
        property: "og:description",
        content: "A deeper reference library for the things you grow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GardenLibrary,
});

function GardenLibrary() {
  return (
    <div className="rise pb-20">
      <PageHeader
        eyebrow="Library"
        title="Garden Library"
        subtitle="A deeper catalog for plants and growing systems is taking root here."
      />
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="space-y-4">
          <div className="surface grid min-h-72 place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-2xl">The full catalog is coming later</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                For now, each plant profile keeps its concise, trusted reference close to the living
                record.
              </p>
              <Sprout className="mx-auto mt-6 h-4 w-4 text-moss" />
            </div>
          </div>
          <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-xl">
              <p className="eyebrow">Garden Labs</p>
              <h2 className="mt-2 font-display text-2xl">Explore Garden Library</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Explore the experimental version of Garden Library, with its complete public plant
                knowledge and sources.
              </p>
            </div>
            <Link
              to="/gardenpedia"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-primary px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              Entrar a Garden Labs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
