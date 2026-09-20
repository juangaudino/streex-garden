import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <main className="min-h-screen bg-[#f4f1e8]">
      <iframe
        title="Gardenpedia"
        src="/gardenpedia/index.html"
        className="block h-screen w-full border-0"
        loading="eager"
      />
    </main>
  );
}
