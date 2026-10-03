import { useEffect, useState, type FormEvent } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

import { GardenProvider, useGarden } from "@/lib/garden-store";
import { AppShell } from "@/components/garden/shell";
import { JournalEntryProvider } from "@/components/garden/journal-entry";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { getSupabaseClient, hasSupabaseConfiguration } from "@/lib/supabase";
import { preferredLanguage, ui } from "@/lib/ui-copy";

export function GardenApplication() {
  return (
    <GardenProvider>
      <GardenExperience />
    </GardenProvider>
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
    void client.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  if (pathname.startsWith("/shared/")) {
    return (
      <>
        <Outlet />
        <Toaster position="top-center" />
      </>
    );
  }
  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <span className="breathe font-display text-xl text-primary">Garden X</span>
      </main>
    );
  }
  if (!signedIn)
    return (
      <>
        <SignInGate />
        <Toaster position="top-center" />
      </>
    );

  return (
    <>
      <JournalEntryProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </JournalEntryProvider>
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
    setBusy(true);
    setError("");
    void getSupabaseClient()
      .auth.signInWithPassword({ email: email.trim(), password })
      .then(({ error: authError }) => {
        if (authError) setError(ui(language, "signInFailed"));
      })
      .finally(() => setBusy(false));
  };
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <form onSubmit={submit} className="surface w-full max-w-sm p-6 sm:p-8">
        <p className="eyebrow">Garden X</p>
        <h1 className="mt-2 font-display text-3xl font-medium">{ui(language, "gardenWaiting")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ui(language, "signInPrivateHistory")}</p>
        <label className="mt-6 block text-sm">
          <span className="mb-2 block text-muted-foreground">{ui(language, "email")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            className="input-soft"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-2 block text-muted-foreground">{ui(language, "password")}</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="input-soft"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy} className="mt-5 w-full rounded-full">
          {busy ? ui(language, "signingIn") : ui(language, "signInAction")}
        </Button>
      </form>
    </main>
  );
}
