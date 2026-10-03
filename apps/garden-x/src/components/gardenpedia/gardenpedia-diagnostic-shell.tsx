/**
 * Temporary P0 isolation shell.
 *
 * Keep this entry deliberately dependency-free so the physical-device bisect
 * can distinguish the Gardenpedia feature tree from the shared app runtime.
 * Remove this diagnostic route only after the physical result is reported.
 */
export function GardenpediaDiagnosticShell() {
  return (
    <main
      aria-labelledby="gardenpedia-diagnostic-title"
      className="min-h-screen bg-background px-6 py-10"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Garden X
        </p>
        <h1 id="gardenpedia-diagnostic-title" className="font-display text-3xl">
          Gardenpedia
        </h1>
        <p className="text-base text-muted-foreground">Diagnostic shell</p>
        <a
          href="/gardenpedia/"
          className="inline-flex w-fit items-center rounded-full border border-border px-4 py-2 text-sm"
        >
          Reload shell
        </a>
      </div>
    </main>
  );
}
