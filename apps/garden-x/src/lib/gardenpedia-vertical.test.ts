import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const read = (path: string) => readFileSync(join(repo, path), "utf8");

function fixtureProfile() {
  return {
    profileVersion: 1,
    hydroponicSuitability: {
      status: "unknown",
      reason: "No applicable production evidence was found.",
    },
    growthHabits: { status: "unknown", reason: "No controlled growth habit was established." },
    matureSize: {
      height: { status: "unknown", reason: "No scoped height evidence was found." },
      spread: { status: "unknown", reason: "No scoped spread evidence was found." },
    },
    spacing: { status: "unknown", reason: "No spacing evidence was found." },
    light: { status: "unknown", reason: "No comparable light evidence was found." },
  };
}

function publicationFixture() {
  const source = {
    id: "source-seaside",
    title: "University crop guide",
    publisher: "University Extension",
    url: "https://extension.usu.edu/example/seaside-spinach",
    type: "university_research",
    scope: "general",
    accessed: "2026-09-26",
  };
  const plant = {
    id: "seaside-f1-spinach",
    name: "Seaside F1 Spinach",
    spanishName: "",
    scientificName: "Spinacia oleracea",
    variety: "Seaside F1",
    category: "leafy greens",
    emoji: "🥬",
    summary: "Seaside F1 spinach identity and available evidence.",
    guideCompletion: 40,
    tags: ["spinach"],
    metrics: [],
    sections: {
      identity: {
        short: "F1 cultivar identity is documented.",
        evidenceType: "source_backed",
        confidence: "high",
        sourceIds: [source.id],
      },
    },
    compatibilityProfile: fixtureProfile(),
  };
  return {
    schemaVersion: "gardenpedia_publication_bundle_v1",
    requestId: "request-test-1",
    proposalId: "proposal-test-1",
    approvedAt: "2026-09-26T12:00:00.000Z",
    approvedBy: "curator-test",
    candidateIdentity: { id: plant.id },
    proposedData: {
      plant,
      identityEvidence: [
        {
          claim: "Seaside F1 is the named cultivar",
          taxonomicScope: { level: "identity" },
          confidence: "high",
          evidenceType: "source_backed",
          sourceIds: [source.id],
        },
      ],
      unknowns: ["Hydroponic production evidence was not established."],
      sources: [source],
    },
  };
}

function runPublication(dataDir: string, bundle: unknown) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const tempBundle = join(dataDir, "bundle.json");
  writeFileSync(tempBundle, JSON.stringify(bundle));
  return spawnSync(
    "node",
    [join(root, "scripts/gardenpedia-prepare-publication.mjs"), tempBundle],
    {
      cwd: root,
      env: { ...process.env, GARDENPEDIA_DATA_DIR: dataDir },
      encoding: "utf8",
    },
  );
}

describe("Gardenpedia request-to-publication vertical", () => {
  it("keeps Library and My Seeds on one explicit, non-creating resolver", () => {
    const resolver = read("labs/gardenpedia/identity-resolver-v1.js");
    const app = read("labs/gardenpedia/app.js");
    expect(resolver).toContain(
      "GardenpediaIdentityResolver = Object.freeze({ normalize, search, exactMatch, describe })",
    );
    expect(resolver).toContain("...(plant.aliases || []), ...(plant.tags || [])");
    expect(resolver).not.toContain("createIdentity");
    expect(app).toContain("GardenpediaIdentityResolver?.search(query, state.plants)");
    expect(app).toContain("GardenpediaIdentityResolver?.search(nameInput.value, state.plants)");
    expect(app).toContain("createRequest(nameInput.value.trim())");
    expect(app).toContain("No catalog match. You can keep this package unresolved.");
    expect(app).toContain("archived: current?.archived === true");
    expect(app).toContain("exactMatch(nameInput.value, [selected])");
  });

  it("keeps package CRUD owner-scoped and machine definitions separate from instances", () => {
    const migration =
      read("supabase/migrations/20260926165631_gardenpedia_account_seed_packages.sql") +
      read("supabase/migrations/20260926173442_gardenpedia_vertical_completion.sql");
    const transport = read("labs/gardenpedia/supabase-lab-transport.js");
    const machines = read("labs/gardenpedia/machines-v1.js");
    expect(migration).toContain("garden_seed_package_delete(p_package_id uuid)");
    expect(migration).toContain("where p.owner_id = v_owner");
    expect(migration).toContain("where id = v_id and owner_id = v_owner");
    expect(migration).toContain("on conflict do nothing");
    expect(transport).toContain('rpc("garden_seed_package_delete"');
    expect(transport).toContain('rpc("gardenpedia_get_my_machines")');
    expect(machines).toContain("modelUnknown");
    expect(machines).toContain("instance.name");
    expect(machines).toContain("instance.modelId");
    expect(machines).toContain("const name = instance.name || definition?.name");
    expect(machines).toContain("const pods = instance.positions ?? definition?.pods");
    expect(machines).not.toContain("garden_lab.machine_state");
  });

  it("keeps request/proposal private and curator-only operations server-authorized", () => {
    const baseMigration = read(
      "supabase/migrations/20260926165809_gardenpedia_requests_proposals.sql",
    );
    const completion = read(
      "supabase/migrations/20260926173442_gardenpedia_vertical_completion.sql",
    );
    expect(baseMigration).toContain("(select auth.uid()) = owner_id");
    expect(completion).toContain(
      "if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required'",
    );
    expect(completion).toContain("review_status='approved'");
    expect(completion).toContain("published',publication_status='published'");
    expect(completion).not.toMatch(/insert\s+into\s+garden\.library_catalog_items/i);
    expect(completion).toContain("publication_status='publishing'");
  });

  it("prepares a versioned public source change from an approved proposal while preserving unknowns", () => {
    const directory = mkdtempSync(join(tmpdir(), "gardenpedia-publication-"));
    try {
      mkdirSync(directory, { recursive: true });
      const result = runPublication(directory, publicationFixture());
      expect(result.status, result.stderr).toBe(0);
      const plants = JSON.parse(readFileSync(join(directory, "plants-requests.json"), "utf8"));
      expect(plants).toHaveLength(1);
      expect(plants[0].id).toBe("seaside-f1-spinach");
      expect(plants[0].compatibilityProfile.hydroponicSuitability.status).toBe("unknown");
      expect(plants[0].sections.identity.sourceIds).toEqual(["source-seaside"]);
      expect(
        JSON.parse(readFileSync(join(directory, "sources-requests.json"), "utf8")),
      ).toHaveLength(1);
      expect(JSON.stringify(plants)).not.toMatch(/request-test-1|proposal-test-1|curator-test/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects duplicate identities, dangling provenance, and private metadata before staging", () => {
    const directory = mkdtempSync(join(tmpdir(), "gardenpedia-publication-invalid-"));
    try {
      const duplicateData = publicationFixture();
      writeFileSync(
        join(directory, "plants-requests.json"),
        JSON.stringify([{ id: "seaside-f1-spinach" }]),
      );
      const duplicate = runPublication(directory, duplicateData);
      expect(duplicate.status).not.toBe(0);
      expect(duplicate.stderr).toContain("Duplicate catalog identity");

      writeFileSync(join(directory, "plants-requests.json"), "[]");
      const privateData = publicationFixture();
      (privateData.proposedData as Record<string, unknown>).owner_id = "private-user";
      const privateResult = runPublication(directory, privateData);
      expect(privateResult.status).not.toBe(0);
      expect(privateResult.stderr).toContain("Private metadata is forbidden");

      const orphaned = publicationFixture();
      const plant = orphaned.proposedData.plant;
      plant.sections.identity.sourceIds = ["missing-source"];
      const orphanResult = runPublication(directory, orphaned);
      expect(orphanResult.status).not.toBe(0);
      expect(orphanResult.stderr).toContain("dangling source ID");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps the approved publication bridge versioned and does not run Grow Guide Lab publication", () => {
    const workflow = read(".github/workflows/gardenpedia-publication.yml");
    const script = read("scripts/gardenpedia-prepare-publication.mjs");
    const publisher = read("scripts/publish-gardenpedia.mjs");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("gh pr create --base main");
    expect(workflow).toContain(
      "cd apps/garden-x && npm install --no-audit --no-fund && npm run build",
    );
    expect(workflow).not.toContain("run: npm run build");
    expect(script).toContain("validateCompatibilityProfile(plant.compatibilityProfile, sourceIds)");
    expect(script).toContain("rejectPrivateMetadata(proposedData)");
    expect(publisher).toContain('"data/plants-requests.json"');
  });

  it("preserves authenticated Gardenpedia entry points and legacy seed keys in the published artifact", () => {
    const publisher = read("scripts/publish-gardenpedia.mjs");
    const page = read("labs/gardenpedia/index.html");
    expect(page).toContain("supabase-lab-transport.js?v=3");
    expect(page).toContain("identity-resolver-v1.js?v=2");
    expect(page).toContain("gardenpedia-account-v1.js?v=2");
    expect(page).toContain("app.js?v=1.4");
    expect(publisher).not.toContain("gardenpedia-account-v1.js?v=1");
    expect(publisher).not.toContain('gardenLabsSeedStateV1", "gardenpediaPublicSeedStateV1');
    expect(publisher).not.toContain('gardenLabsCustomSeedsV1", "gardenpediaPublicCustomSeedsV1');
  });
});
