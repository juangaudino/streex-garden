import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Leaf } from "lucide-react";
import { toast } from "sonner";
import { PublicStoryView } from "@/components/garden/public-story";
import { Button } from "@/components/ui/button";
import { useGarden } from "@/lib/garden-store";
import { loadPublicPlantStory } from "@/lib/garden-backend";
import type { PublicStory } from "@/lib/public-story";

export const Route = createFileRoute("/shared/$storyId")({
  head: () => ({
    meta: [
      { title: "A shared plant story — Garden X" },
      { name: "description", content: "A curated, recorded plant history shared from Garden X." },
      { property: "og:title", content: "A shared plant story — Garden X" },
      { property: "og:description", content: "A curated, recorded plant history shared from Garden X." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedStoryPage,
});

function SharedStoryPage() {
  const { storyId } = Route.useParams();
  const { publicStories } = useGarden();
  const localStory = publicStories.find((item) => item.id === storyId);
  const [remoteStory, setRemoteStory] = useState<PublicStory | null>(null);
  const [loading, setLoading] = useState(!localStory);

  useEffect(() => {
    if (localStory) { setLoading(false); return; }
    void loadPublicPlantStory(storyId)
      .then(setRemoteStory)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [storyId, localStory]);

  const story = localStory ?? remoteStory;
  if (loading) return <main className="grid min-h-screen place-items-center bg-background px-5 text-center"><Leaf className="h-7 w-7 text-primary breathe" strokeWidth={1.5} /></main>;

  if (!story) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
        <div className="max-w-sm">
          <Leaf className="mx-auto h-7 w-7 text-primary" strokeWidth={1.5} />
          <h1 className="mt-5 font-display text-3xl font-light">This story isn't available</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This story may have been revoked or is no longer available.</p>
          <Button asChild variant="outline" className="mt-6 rounded-full"><Link to="/">Return to Garden</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <div className="relative">
      <PublicStoryView story={story} />
      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-5">
        <Button className="rounded-full shadow-lift" onClick={() => { void navigator.clipboard.writeText(window.location.href); toast.success("Public story link copied"); } }><Copy /> Copy story link</Button>
      </div>
    </div>
  );
}