import { useEffect } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import { retireLegacyGardenpediaRuntime } from "@/lib/gardenpedia-runtime-recovery";

export const Route = createFileRoute("/gardenpedia")({
  component: Gardenpedia,
});

function Gardenpedia() {
  useEffect(() => {
    void retireLegacyGardenpediaRuntime().catch(() => {
      // Recovery is best-effort and must never prevent public Gardenpedia from
      // rendering when a browser denies service-worker/cache access.
    });
  }, []);

  return <Outlet />;
}
