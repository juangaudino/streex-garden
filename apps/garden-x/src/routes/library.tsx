import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Sprout } from "lucide-react";
import { PageHeader } from "@/components/garden/shell";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Garden Library — Garden X" },
      { name: "description", content: "The future home of Garden X plant, seed, and growing-system reference." },
      { property: "og:title", content: "Garden Library — Garden X" },
      { property: "og:description", content: "A deeper reference library for the things you grow." },
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
        <div className="surface grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
              <BookOpen className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-2xl">The full catalog is coming later</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              For now, each plant profile keeps its concise, trusted reference close to the living record.
            </p>
            <Sprout className="mx-auto mt-6 h-4 w-4 text-moss" />
          </div>
        </div>
      </div>
    </div>
  );
}