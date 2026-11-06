// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { GardenApplication } from "./garden-application";

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Outlet: () => null, useRouterState: () => "/" }));
vi.mock("@/lib/garden-store", () => ({
  GardenProvider: ({ children }: { children: ReactNode }) => children,
  useGarden: () => ({ language: "en", appearance: "light" }),
}));
vi.mock("@/components/garden/shell", () => ({ AppShell: () => null }));
vi.mock("@/components/garden/journal-entry", () => ({ JournalEntryProvider: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/lib/supabase", () => ({
  hasSupabaseConfiguration: () => true,
  getSupabaseClient: () => ({ auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: mocks.signIn,
  } }),
}));

afterEach(() => { cleanup(); mocks.signIn.mockReset(); });

describe("Garden sign-in error messages", () => {
  it.each([
    [{ name: "AuthRetryableFetchError", status: 0 }, /cannot reach the sign-in service/i],
    [{ name: "AuthApiError", status: 400 }, /check your details/i],
  ])("distinguishes service failure from rejected credentials", async (error, message) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    mocks.signIn.mockResolvedValue({ error });
    const user = userEvent.setup();
    render(<GardenApplication />);
    await user.type(await screen.findByLabelText("Email"), "person@example.test");
    await user.type(screen.getByLabelText("Password"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText(message)).toBeTruthy());
  });
});
