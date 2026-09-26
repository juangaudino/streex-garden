import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const resolverSource = readFileSync(
  new URL("../../../../labs/gardenpedia/identity-resolver-v1.js", import.meta.url),
  "utf8",
);
const accountSource = readFileSync(
  new URL("../../../../labs/gardenpedia/gardenpedia-account-v1.js", import.meta.url),
  "utf8",
);
const publisherSource = readFileSync(
  new URL("../../../../scripts/publish-gardenpedia.mjs", import.meta.url),
  "utf8",
);

describe("Gardenpedia account integration", () => {
  it("returns explicit catalog candidates and never creates identities from a fuzzy query", () => {
    const window = {} as Record<string, unknown>;
    runInNewContext(resolverSource, { window });
    const resolver = window.GardenpediaIdentityResolver as {
      search: (
        query: string,
        plants: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>;
    };
    const catalog = [
      { id: "tiny-tim-tomato", name: "Tiny Tim Tomato", scientificName: "Solanum lycopersicum" },
      { id: "cherry-tomato", name: "Cherry Tomato", scientificName: "Solanum lycopersicum" },
    ];

    expect(resolver.search("Tiny Tim Tomato", catalog).map((item) => item.id)).toEqual([
      "tiny-tim-tomato",
    ]);
    expect(resolver.search("tomato", catalog).map((item) => item.id)).toEqual([
      "cherry-tomato",
      "tiny-tim-tomato",
    ]);
    expect(resolver.search("tomatillo purple dragon", catalog)).toEqual([]);
    expect("createIdentity" in resolver).toBe(false);
  });

  it("loads private account data without automatically importing localStorage", async () => {
    const oldLocal = {
      gardenLabsSeedStateV1: JSON.stringify({ basil: { packageStatus: "opened" } }),
      gardenLabsCustomSeedsV1: JSON.stringify([{ id: "custom-1", packetName: "My seed packet" }]),
    };
    const localStorage = {
      getItem: vi.fn((key: string) => oldLocal[key as keyof typeof oldLocal] || null),
    };
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ packages: [] }), { status: 200 }),
    );
    const window = {
      GARDEN_X_AUTH: { getSession: vi.fn(async () => ({ user: { id: "user-a" } })) },
    } as Record<string, unknown>;
    runInNewContext(accountSource, { window, localStorage, fetch, console });

    const state: Record<string, unknown> = {
      seedPackages: [{ stale: true }],
      seedUserState: { stale: true },
    };
    await (window.GARDEN_LABS_STORAGE_HYDRATE as (value: Record<string, unknown>) => Promise<void>)(
      state,
    );

    expect(state.accountMode).toBe("ready");
    expect(state.seedPackages).toEqual([]);
    expect(state.seedUserState).toEqual({});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/gardenpedia/seed-packages");
    expect(localStorage.getItem("gardenLabsSeedStateV1")).toBe(oldLocal.gardenLabsSeedStateV1);
    expect(localStorage.getItem("gardenLabsCustomSeedsV1")).toBe(oldLocal.gardenLabsCustomSeedsV1);
  });

  it("offers reconciliation only as an explicit operation", async () => {
    const calls: Array<{ url: string; operation?: string }> = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        operation: init?.body ? JSON.parse(String(init.body)).operation : undefined,
      });
      return new Response(JSON.stringify({ imported: 1, inventory: { packages: [] } }), {
        status: 200,
      });
    });
    const localStorage = {
      getItem: vi.fn((key: string) =>
        key === "gardenLabsSeedStateV1" ? '{"basil":{"packageStatus":"opened"}}' : "[]",
      ),
    };
    const window = {
      GARDEN_X_AUTH: { getSession: async () => ({ user: { id: "user-a" } }) },
    } as Record<string, unknown>;
    runInNewContext(accountSource, { window, localStorage, fetch, console });
    const account = window.GARDENPEDIA_ACCOUNT as { reconcileLegacy: () => Promise<unknown> };

    expect(calls).toEqual([]);
    await account.reconcileLegacy();
    expect(calls).toEqual([{ url: "/api/gardenpedia/seed-packages", operation: "reconcile" }]);
  });

  it("keeps the authenticated account hydration in the published Gardenpedia bundle", () => {
    expect(publisherSource).toContain('"gardenpedia-account-v1.js"');
    expect(publisherSource).toContain('"supabase-lab-transport.js"');
    expect(publisherSource).not.toContain(
      '"if (window.GARDEN_LABS_STORAGE_HYDRATE) await window.GARDEN_LABS_STORAGE_HYDRATE(state);"',
    );
  });

  it("keeps legacy account machines out of the canonical machine list", () => {
    const migration = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260926165631_gardenpedia_account_seed_packages.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const functionBody = migration.split(
      "create or replace function public.gardenpedia_get_my_machines()",
    )[1];
    expect(functionBody).toContain("garden.system_instances");
    expect(functionBody).toContain("garden.gardens");
    expect(functionBody).toContain("s.owner_id=v_owner");
    expect(functionBody).toContain("s.gardenpedia_model_id");
    expect(functionBody).not.toContain("garden_lab.machine_state");
  });

  it("guards private inventory with owner-scoped RPCs and no direct table grants", () => {
    const migration = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260926165631_gardenpedia_account_seed_packages.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("library_plant_id text references garden.library_catalog_items");
    expect(migration).not.toMatch(/library_plant_id text not null/);
    expect(migration).toContain(
      "revoke all on garden.seed_packages from public, anon, authenticated",
    );
    expect(migration).toContain("where p.owner_id = v_owner");
    expect(migration).toContain("where id = v_id and owner_id = v_owner");
    expect(migration).toContain("legacy_source_key=r.seed_key");
    expect(migration).toContain("on conflict do nothing");
  });

  it("makes Gardenpedia requests/proposals private and separates approval from publication", () => {
    const migration = readFileSync(
      new URL(
        "../../../../supabase/migrations/20260926165809_gardenpedia_requests_proposals.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain("garden.gardenpedia_requests");
    expect(migration).toContain("garden.gardenpedia_proposals");
    expect(migration).toContain("(select auth.uid()) = owner_id");
    expect(migration).toContain("garden.gardenpedia_is_curator()");
    expect(migration).toContain(
      "revoke all on garden.gardenpedia_requests from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on garden.gardenpedia_proposals from public, anon, authenticated",
    );
    expect(migration).toContain("where r.owner_id=v_owner");
    expect(migration).toContain("Editorial approval intentionally does not publish");
    expect(migration).not.toMatch(/insert\s+into\s+garden\.library_catalog_items/i);
  });
});
