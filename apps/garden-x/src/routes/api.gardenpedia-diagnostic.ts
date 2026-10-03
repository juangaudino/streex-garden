import { createFileRoute } from "@tanstack/react-router";

import { sanitizeGardenpediaDiagnosticPayload } from "@/lib/gardenpedia-diagnostic-contract";

export const Route = createFileRoute("/api/gardenpedia-diagnostic")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 4_096) return new Response(null, { status: 204 });

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response(null, { status: 204 });
        }

        const event = sanitizeGardenpediaDiagnosticPayload(payload);
        if (event) console.log("[gardenpedia-diagnostic]", JSON.stringify(event));
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
