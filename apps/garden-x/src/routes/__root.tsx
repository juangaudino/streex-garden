import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { GardenProvider, useGarden } from "@/lib/garden-store";
import { AppShell } from "@/components/garden/shell";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseClient, hasSupabaseConfiguration } from "@/lib/supabase";
import { preferredLanguage, ui } from "@/lib/ui-copy";

function NotFoundComponent() {
  const language = typeof window === "undefined" ? "en" : preferredLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl">404</h1>
        <h2 className="mt-4 font-display text-xl">{ui(language, "notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ui(language, "notFoundBody")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ui(language, "backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl">{ui(preferredLanguage(), "pageDidntLoad")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ui(preferredLanguage(), "genericLoadError")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ui(preferredLanguage(), "tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            {ui(preferredLanguage(), "goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#f5f3eb" },
      { title: "Garden X — the living history of every plant" },
      {
        name: "description",
        content:
          "Garden X records photos, care and events so you can see how each plant really changed over weeks, months and years.",
      },
      { property: "og:title", content: "Garden X — the living history of every plant" },
      {
        property: "og:description",
        content: "Photos, care and milestones become the real story of every plant you grow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/app-icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { queryClient } = Route.useRouteContext();

  // Gardenpedia is a public, read-only laboratory surface. Keep it outside
  // the authenticated GardenProvider so it cannot hydrate private gardens,
  // photos, or session state while it is being viewed anonymously.
  if (pathname === "/gardenpedia" || pathname.startsWith("/gardenpedia/")) {
    return (
      <>
        <Outlet />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GardenProvider>
        <GardenExperience />
      </GardenProvider>
    </QueryClientProvider>
  );
}

function GardenExperience() {
  const { language, appearance } = useGarden();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [authReady, setAuthReady] = useState(!hasSupabaseConfiguration());
  const [signedIn, setSignedIn] = useState(!hasSupabaseConfiguration());

  useEffect(() => {
    if (!hasSupabaseConfiguration()) return;
    const client = getSupabaseClient();
    void client.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setAuthReady(true); });
    const { data } = client.auth.onAuthStateChange((_event, session) => { setSignedIn(Boolean(session)); setAuthReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", appearance === "dark" || (appearance === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  if (pathname.startsWith("/shared/")) return <><Outlet /><Toaster position="top-center" /></>;
  if (!authReady) return <main className="grid min-h-screen place-items-center bg-background"><span className="breathe font-display text-xl text-primary">Garden X</span></main>;
  if (!signedIn) return <><SignInGate /><Toaster position="top-center" /></>;

  return (
    <>
      <AppShell><Outlet /></AppShell>
      <Toaster position="top-center" />
    </>
  );
}

function SignInGate() {
  const language = preferredLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    void getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password })
      .then(({ error: authError }) => { if (authError) setError(ui(language, "signInFailed")); })
      .finally(() => setBusy(false));
  };
  return <main className="grid min-h-screen place-items-center bg-background px-5">
    <form onSubmit={submit} className="surface w-full max-w-sm p-6 sm:p-8">
      <p className="eyebrow">Garden X</p>
      <h1 className="mt-2 font-display text-3xl font-medium">{ui(language, "gardenWaiting")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{ui(language, "signInPrivateHistory")}</p>
      <label className="mt-6 block text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "email")}</span><input type="email" required autoComplete="email" className="input-soft" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="mt-4 block text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "password")}</span><input type="password" required autoComplete="current-password" className="input-soft" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy} className="mt-5 w-full rounded-full">{busy ? ui(language, "signingIn") : ui(language, "signInAction")}</Button>
    </form>
  </main>;
}
