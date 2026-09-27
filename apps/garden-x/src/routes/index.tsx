import { createFileRoute } from "@tanstack/react-router";
import { HomeJournalView } from "@/components/garden/home-journal-view";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Your garden journal — Garden X" },
      {
        name: "description",
        content:
          "A living journal of your plants, their moments, and the photos that show their story.",
      },
      { property: "og:title", content: "Your garden journal — Garden X" },
      { property: "og:description", content: "A living journal of your plants and their stories." },
    ],
  }),
  component: HomeJournalView,
});
