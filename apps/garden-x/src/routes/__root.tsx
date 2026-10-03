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
import { lazy, Suspense, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { recordGardenpediaMilestone } from "../lib/gardenpedia-diagnostic";
import { Toaster } from "@/components/ui/sonner";
import { preferredLanguage, ui } from "@/lib/ui-copy";

const GardenApplication = lazy(() =>
  import("@/components/garden/garden-application").then(({ GardenApplication }) => ({
    default: GardenApplication,
  })),
);

function NotFoundComponent() {
  const language = typeof window === "undefined" ? "en" : preferredLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl">404</h1>
        <h2 className="mt-4 font-display text-xl">{ui(language, "notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{ui(language, "notFoundBody")}</p>
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f5f3eb" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
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

  useEffect(() => {
    const isGardenpedia = pathname === "/gardenpedia" || pathname.startsWith("/gardenpedia/");
    if (!isGardenpedia) return;

    recordGardenpediaMilestone("gardenpedia_hydration_start");
    recordGardenpediaMilestone("gardenpedia_storage_init", {
      detail:
        typeof window === "undefined"
          ? "server"
          : (() => {
              try {
                window.sessionStorage.getItem("gardenpedia-diagnostic-session-v1");
                return "session-readable";
              } catch {
                return "session-blocked";
              }
            })(),
    });
    recordGardenpediaMilestone("gardenpedia_sw_state", {
      detail:
        typeof navigator === "undefined"
          ? "unavailable"
          : !("serviceWorker" in navigator)
            ? "unsupported"
            : navigator.serviceWorker.controller
              ? "controlled"
              : "uncontrolled",
    });
    const frame = window.requestAnimationFrame(() => {
      recordGardenpediaMilestone("gardenpedia_hydration_complete");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

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
      <Suspense
        fallback={
          <main className="grid min-h-screen place-items-center bg-background">
            <span className="breathe font-display text-xl text-primary">Garden X</span>
          </main>
        }
      >
        <GardenApplication />
      </Suspense>
    </QueryClientProvider>
  );
}
