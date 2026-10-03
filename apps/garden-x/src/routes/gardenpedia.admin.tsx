import { createFileRoute } from "@tanstack/react-router";

import { GardenpediaAdmin } from "@/components/gardenpedia/private-surfaces";
import { preferredLanguage } from "@/lib/ui-copy";

export const Route = createFileRoute("/gardenpedia/admin")({
  head: () => ({
    meta: [
      { title: "Gardenpedia · Curator / Master" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GardenpediaAdminRoute,
});

function GardenpediaAdminRoute() {
  return <GardenpediaAdmin language={preferredLanguage()} />;
}
