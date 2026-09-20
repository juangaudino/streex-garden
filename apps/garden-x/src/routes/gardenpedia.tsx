import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/gardenpedia")({
  head: () => ({
    meta: [
      { title: "Gardenpedia · Garden X" },
      {
        name: "description",
        content: "Public plant knowledge, growing guidance, and sources from Garden X.",
      },
    ],
  }),
  component: Gardenpedia,
});

function Gardenpedia() {
  useEffect(() => {
    // Production serves the generated public artifact directly. This route is
    // only a development/SSR fallback and must not introduce an iframe shell.
    if (window.location.pathname === "/gardenpedia") window.location.replace("/gardenpedia/");
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f1e8] px-6 text-center">
      <p className="font-display text-xl text-[#17352a]">Opening Gardenpedia…</p>
    </main>
  );
}
