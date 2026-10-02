import { createFileRoute } from "@tanstack/react-router";
import { GardenpediaDirect } from "@/components/gardenpedia/gardenpedia-direct";

export const Route = createFileRoute("/gardenpedia")({
  head: () => ({
    meta: [
      { title: "Gardenpedia · Garden X" },
      {
        name: "description",
        content: "Public plant knowledge, growing guidance, and sources from Garden X.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: Gardenpedia,
});

function Gardenpedia() {
  return <GardenpediaDirect />;
}
