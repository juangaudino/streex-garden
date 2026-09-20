export function RouteLoading({ label = "Loading your garden…" }: { label?: string }) {
  return (
    <main className="grid min-h-[50vh] place-items-center bg-background px-5">
      <p className="breathe font-display text-xl text-primary">{label}</p>
    </main>
  );
}
