import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), "utf8");

describe("Gardenpedia React cutover", () => {
  it("keeps public and private surfaces on separate contracts", () => {
    const surfaces = read("apps/garden-x/src/components/gardenpedia/private-surfaces.tsx");
    const explore = read("apps/garden-x/src/components/gardenpedia/donor/explore.tsx");
    expect(surfaces).toContain('"garden_seed_packages_list"');
    expect(surfaces).toContain('"garden_seed_package_save"');
    expect(surfaces).toContain('"garden_seed_package_delete"');
    expect(surfaces).toContain('"gardenpedia_get_my_machines"');
    expect(surfaces).toContain('"gardenpedia_get_my_plants"');
    expect(surfaces).toContain('"gardenpedia_curator_status"');
    expect(surfaces).toContain('"gardenpedia_curator_queue"');
    expect(surfaces).toContain('"gardenpedia_approve_proposal"');
    expect(surfaces).not.toContain("service_role");
    expect(explore).toContain("auth.signedIn");
    expect(explore).toContain("MyGardenSurface");
  });

  it("protects the curator route through backend curator authorization", () => {
    const route = read("apps/garden-x/src/routes/gardenpedia.admin.tsx");
    const surfaces = read("apps/garden-x/src/components/gardenpedia/private-surfaces.tsx");
    expect(route).toContain('createFileRoute("/gardenpedia/admin")');
    expect(surfaces).toContain('rpc<{ isCurator?: boolean }>("gardenpedia_curator_status")');
    expect(surfaces).toContain("if (!isCurator)");
    expect(surfaces).toContain('"gardenpedia_review_proposal"');
    expect(surfaces).toContain('"gardenpedia_export_publication_bundle"');
    expect(surfaces).toContain('"gardenpedia_mark_publication_started"');
  });

  it("makes React the default publisher target and retains legacy publishing explicitly", () => {
    const publisher = read("scripts/publish-gardenpedia.mjs");
    const packageJson = read("apps/garden-x/package.json");
    expect(publisher).toContain("function prepareGeneratedArtifacts()");
    expect(publisher).toContain('else if (process.argv.includes("--legacy")) prepareLegacy();');
    expect(publisher).toContain("else prepareGeneratedArtifacts();");
    expect(packageJson).toContain('"publish:legacy"');
    expect(packageJson).toContain('"prebuild": "node ../../scripts/publish-gardenpedia.mjs"');
  });

  it("registers both the React entry and protected admin route", () => {
    const routes = read("apps/garden-x/src/routeTree.gen.ts");
    const root = read("apps/garden-x/src/routes/__root.tsx");
    const parent = read("apps/garden-x/src/routes/gardenpedia.tsx");
    const index = read("apps/garden-x/src/routes/gardenpedia.index.tsx");
    expect(routes).toContain("'/gardenpedia/admin'");
    expect(routes).toContain("'/gardenpedia/'");
    expect(parent).toContain("<Outlet />");
    expect(index).toContain('createFileRoute("/gardenpedia/")');
    expect(root).toContain('pathname === "/gardenpedia" || pathname.startsWith("/gardenpedia/")');
  });

  it("keeps the public Gardenpedia route out of the authenticated Garden X startup graph", () => {
    const root = read("apps/garden-x/src/routes/__root.tsx");
    const application = read("apps/garden-x/src/components/garden/garden-application.tsx");
    const vite = read("apps/garden-x/vite.config.ts");

    expect(root).toContain('import("@/components/garden/garden-application")');
    expect(root).not.toContain('from "@/lib/garden-store"');
    expect(root).not.toContain('from "@/components/garden/shell"');
    expect(application).toContain("GardenProvider");
    expect(vite).toContain("autoCodeSplitting: true");
  });

  it("uses query-state React navigation instead of document/hash navigation", () => {
    const index = read("apps/garden-x/src/routes/gardenpedia.index.tsx");
    const direct = read("apps/garden-x/src/components/gardenpedia/gardenpedia-direct.tsx");
    const explore = read("apps/garden-x/src/components/gardenpedia/donor/explore.tsx");

    expect(index).toContain("validateSearch");
    expect(index).toContain("Route.useNavigate");
    expect(direct).not.toContain("location.hash");
    expect(direct).not.toContain("hashchange");
    expect(explore).not.toContain("/gardenpedia#");
  });

  it("keeps the public SSR document from preloading the private Garden X graph", () => {
    const server = read("apps/garden-x/src/server.ts");
    expect(server).toContain("stripPublicGardenpediaModulepreloads");
    expect(server).toContain('pathname.startsWith("/gardenpedia")');
    expect(server).toContain('rel="modulepreload"');
  });
});
