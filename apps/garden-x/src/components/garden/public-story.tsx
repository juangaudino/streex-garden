import { CalendarDays, Leaf } from "lucide-react";
import type { PublicStory as PublicStoryData } from "@/lib/public-story";
import { eventLabels, formatDate } from "@/lib/garden-logic";
import { ProvenanceTag } from "@/components/garden/atoms";
import { PhotoImage } from "@/components/garden/photo-image";

export function PublicStoryView({ story, preview = false }: { story: PublicStoryData; preview?: boolean }) {
  const photos = story.moments.filter((moment) => moment.kind === "photo");
  const cover = photos.at(-1);
  const oldest = story.moments[0];
  const latest = story.moments.at(-1);

  return (
    <article className="min-h-screen bg-background text-foreground">
      <header className="relative min-h-[70svh] overflow-hidden bg-secondary">
        {cover?.kind === "photo" ? (
          <PhotoImage photo={cover.photo} alt={`${story.plant.name}, ${cover.photo.caption}`} rendition="display" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Leaf className="h-10 w-10" strokeWidth={1.25} /></div>
        )}
        <div className="veil absolute inset-0" />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-primary-foreground sm:px-8">
          <span className="font-display text-lg">Garden</span>
          <span className="text-xs opacity-75">{preview ? "Public story preview" : "A shared plant story"}</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-10 text-primary-foreground sm:px-8 sm:pb-14">
          <p className="eyebrow opacity-75">A recorded history</p>
          <h1 className="mt-2 font-display text-5xl font-light leading-none sm:text-7xl">{story.plant.name}</h1>
          <p className="mt-4 text-base opacity-85 sm:text-lg">{story.plant.variety} {story.plant.species}</p>
          <p className="mt-1 text-sm italic opacity-65">{story.plant.scientific}</p>
          {oldest && latest ? (
            <p className="mt-6 flex items-center gap-2 text-xs opacity-75"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(oldest.daysAgo)} — {formatDate(latest.daysAgo)}</p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-12 max-w-xl">
          <p className="eyebrow">Selected history</p>
          <h2 className="mt-2 font-display text-3xl font-light leading-tight sm:text-4xl">Moments from a life being tended.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">This story contains only moments its keeper chose from the plant's recorded history, shown in their original order.</p>
        </div>

        <div className="space-y-12 sm:space-y-16">
          {story.moments.map((moment, index) => (
            <section key={moment.id} className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8">
              <div className="pt-1">
                <p className="numeral text-xs text-muted-foreground">{formatDate(moment.daysAgo)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Day {Math.max(1, story.plant.plantedDaysAgo - moment.daysAgo)}</p>
              </div>
              <div>
                {moment.kind === "photo" ? (
                  <figure>
                    <div className="overflow-hidden rounded-2xl bg-secondary">
                      <PhotoImage photo={moment.photo} alt={moment.photo.caption} rendition="preview" className="aspect-[4/5] w-full object-cover sm:aspect-[4/3]" />
                    </div>
                    <figcaption className="mt-3 text-sm leading-relaxed text-muted-foreground">{moment.photo.caption}</figcaption>
                  </figure>
                ) : (
                  <div className="border-l border-border pl-5 sm:pl-7">
                    <p className="eyebrow">{eventLabels[moment.event.type]}</p>
                    <h3 className="mt-2 font-display text-2xl font-light">{moment.event.title}</h3>
                    {moment.event.detail ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{moment.event.detail}</p> : null}
                    <div className="mt-4"><ProvenanceTag kind={moment.event.provenance} /></div>
                  </div>
                )}
                <span className="sr-only">Moment {index + 1} of {story.moments.length}</span>
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-border/70 px-5 py-12 text-center sm:px-8">
        <Leaf className="mx-auto h-5 w-5 text-primary" strokeWidth={1.5} />
        <p className="mt-3 font-display text-lg">Recorded in Garden</p>
        <p className="mt-1 text-xs text-muted-foreground">A real plant story, shared by its keeper.</p>
      </footer>
    </article>
  );
}
