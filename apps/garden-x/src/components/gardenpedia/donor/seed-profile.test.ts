import { describe, expect, it } from "vitest";

import { findCanonicalEntry } from "./canonical-adapter";
import {
  buildSeedProfile,
  buildSeedProfiles,
  canonicalSeedEntries,
  seedProfileCount,
  seedProfileForEntry,
} from "./seed-profile-adapter";
import { buildSeedLibraryCards, filterSeedLibraryCards } from "./seed-library-adapter";
import { gardenLibraryManifest } from "@/generated/garden-library-manifest";

describe("canonical Seed Profile adapter", () => {
  it("exposes every published Seed Profile through the public catalog", () => {
    expect(seedProfileCount).toBe(328);
    expect(canonicalSeedEntries).toHaveLength(328);
    expect(buildSeedProfiles("en")).toHaveLength(328);
    expect(new Set(canonicalSeedEntries.map((entry) => entry.libraryPlantId)).size).toBe(328);
  });

  it("makes every active public identity addressable in the broader propagation view", () => {
    const cards = buildSeedLibraryCards("en");
    const activeCount = gardenLibraryManifest.entries.filter(
      (entry) => entry.status === "active",
    ).length;

    expect(cards).toHaveLength(activeCount);
    expect(new Set(cards.map((card) => card.id)).size).toBe(activeCount);
    expect(filterSeedLibraryCards(cards, { mode: "seeds" })).toHaveLength(328);
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(activeCount);
  });

  it("keeps cover crops as a separate propagation category without inventing Seed Profiles", () => {
    const cards = buildSeedLibraryCards("es");
    const coverCrops = filterSeedLibraryCards(cards, {
      category: "cover crops",
      mode: "propagation",
    });

    expect(coverCrops).toHaveLength(5);
    expect(coverCrops.every((card) => !card.hasSeedProfile)).toBe(true);
    expect(coverCrops.map((card) => card.id)).toEqual(
      expect.arrayContaining([
        "buckwheat-fagopyrum-esculentum",
        "crimson-clover-trifolium-incarnatum",
        "white-clover-trifolium-repens",
        "cereal-rye-secale-cereale",
        "oats-avena-sativa",
      ]),
    );
  });

  it("preserves source-backed non-seed propagation and labels undocumented routes as pending", () => {
    const cards = buildSeedLibraryCards("en");
    const monterey = cards.find((card) => card.id === "monterey-strawberry");
    const oregano = cards.find((card) => card.id === "italian-oregano");
    const dianthus = cards.find((card) => card.id === "fragrant-dwarf-dianthus-mix");

    expect(monterey?.propagationClass).toBe("vegetative_preferred");
    expect(monterey?.sources.map((source) => source.id)).toContain("ucd-monterey-runner-trials");
    expect(oregano?.propagationStatus).toBe("pending");
    expect(dianthus?.propagationStatus).toBe("pending");
    expect(oregano?.propagationSummary).toContain("not a claim");
    expect(dianthus?.propagationSummary).toContain("not a claim");
  });

  it("searches propagation identities in English, Spanish, scientific names and aliases", () => {
    const cards = buildSeedLibraryCards("en");

    expect(
      filterSeedLibraryCards(cards, { query: "lechuga romana roja", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("red-romaine-lettuce");
    expect(
      filterSeedLibraryCards(cards, { query: "Ocimum basilicum", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("genovese-basil");
    expect(
      filterSeedLibraryCards(cards, { query: "CULANTRO", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).not.toContain("cilantro");
    expect(
      filterSeedLibraryCards(cards, { query: "quimbombó", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("okra-abelmoschus-esculentus");
    expect(
      filterSeedLibraryCards(cards, { query: "Amaranthus tricolor", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("vegetable-amaranth-amaranthus-tricolor");
    expect(
      filterSeedLibraryCards(cards, { query: "Maranta leuconeura", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("prayer-plant-maranta-leuconeura");
    expect(
      filterSeedLibraryCards(cards, { query: "", category: "herbs", mode: "seeds" }).every(
        (card) => card.category === "herbs" && card.hasSeedProfile,
      ),
    ).toBe(true);
  });

  it("keeps the rich Genovese Basil profile connected to canonical sources", () => {
    const profile = seedProfileForEntry("genovese-basil", "en");

    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("Genovese Basil");
    expect(profile?.scientificName).toContain("Ocimum");
    expect(profile?.protocol.length).toBeGreaterThan(0);
    expect(profile?.sources.length).toBeGreaterThan(0);
    expect(profile?.sources.every((source) => source.url.startsWith("http"))).toBe(true);
  });

  it("renders new seed profiles with scoped agronomy and honest unknowns in EN/ES", () => {
    const okra = seedProfileForEntry("okra-abelmoschus-esculentus", "en");
    const amaranth = seedProfileForEntry("vegetable-amaranth-amaranthus-tricolor", "es");

    expect(okra?.metrics.some((fact) => fact.key === "temperature")).toBe(true);
    expect(okra?.sources.some((source) => source.id === "uf-ifas-okra-production-500")).toBe(true);
    expect(JSON.stringify(okra)).toMatch(/light\/dark|light-versus-dark/i);
    expect(amaranth?.name).toBe("Vegetable Amaranth");
    expect(amaranth?.spanishName).toBe("Amaranto de hoja");
    expect(amaranth?.protocol.some((section) => section.title === "Siembra")).toBe(true);
    expect(amaranth?.evidence.needsValidation).toBeGreaterThan(0);
  });

  it("renders Hoja Santa seed evidence and its source without inventing germination values", () => {
    const profile = seedProfileForEntry("hoja-santa-piper-auritum", "en");

    expect(profile?.sources.map((source) => source.id)).toContain("rhs-piper-auritum-wave36");
    expect(profile?.metrics.find((metric) => metric.key === "germination")?.evidenceType).toBe(
      "needs_validation",
    );
    expect(seedProfileForEntry("hoja-santa-piper-auritum", "es")?.name).toBe("Hoja Santa");
  });

  it("publishes Wave 24 seed identities in English and Spanish with source links", () => {
    const ids = [
      "celeriac-apium-graveolens",
      "radicchio-cichorium-intybus",
      "jicama-pachyrhizus-erosus",
      "scarlet-runner-bean-phaseolus-coccineus",
      "chickpea-cicer-arietinum",
      "lentil-vicia-lens",
    ];

    for (const id of ids) {
      const en = seedProfileForEntry(id, "en");
      const es = seedProfileForEntry(id, "es");
      expect(en?.sources.length).toBeGreaterThan(0);
      expect(es?.sources.length).toBe(en?.sources.length);
      expect(en?.protocol.length).toBeGreaterThan(0);
      expect(es?.protocol.some((section) => section.title.length > 0)).toBe(true);
    }
    expect(
      seedProfileForEntry("lentil-vicia-lens", "en")?.evidence.needsValidation,
    ).toBeGreaterThan(0);
    expect(
      seedProfileForEntry("jicama-pachyrhizus-erosus", "es")?.evidence.needsValidation,
    ).toBeGreaterThan(0);
  });

  it("publishes Wave 25 profiles in EN/ES with taxonomy and unresolved fields preserved", () => {
    for (const id of [
      "southern-pea-vigna-unguiculata",
      "mung-bean-vigna-radiata",
      "tong-hao-glebionis-coronaria",
      "honeydew-melon-cucumis-melo",
    ]) {
      const en = seedProfileForEntry(id, "en");
      const es = seedProfileForEntry(id, "es");
      expect(en?.sources.length).toBeGreaterThan(0);
      expect(es?.sources.length).toBe(en?.sources.length);
      expect(en?.protocol.length).toBeGreaterThan(0);
      expect(es?.protocol.some((section) => section.title === "Siembra")).toBe(true);
      expect(en?.evidence.needsValidation).toBeGreaterThan(0);
    }
    expect(JSON.stringify(seedProfileForEntry("mung-bean-vigna-radiata", "en"))).toMatch(/65°F|65 °F/);
    expect(JSON.stringify(seedProfileForEntry("honeydew-melon-cucumis-melo", "en"))).toMatch(/not.*germination|no.*germinación/i);
  });

  it("keeps Wave 19 profiles searchable, sourced, localized, and scoped", () => {
    const cress = seedProfileForEntry("garden-cress-lepidium-sativum", "en");
    const cornSalad = seedProfileForEntry("corn-salad-valeriana-locusta", "es");
    const sorrel = seedProfileForEntry("common-sorrel-rumex-acetosa", "en");

    expect(cress?.sources.some((source) => source.id === "johnnys-cress-growing-500")).toBe(true);
    expect(JSON.stringify(cress)).toMatch(/not a germination-time|no es un dato de tiempo de germinación/i);
    expect(cornSalad?.name).toBe("Corn Salad");
    expect(cornSalad?.spanishName).toBe("Canónigos");
    expect(cornSalad?.sources.some((source) => source.id === "usu-lambs-lettuce-500")).toBe(true);
    expect(JSON.stringify(cornSalad)).toMatch(/Valeriana locusta|Valerianella locusta/);
    expect(sorrel?.sources.some((source) => source.id === "rhs-sorrel-growing-500")).toBe(true);
    expect(sorrel?.evidence.needsValidation).toBeGreaterThan(0);
  });

  it("keeps Wave 20 species scope, source resolution, EN/ES, and uncertainty explicit", () => {
    for (const id of [
      "malabar-spinach-basella-alba",
      "yardlong-bean-vigna-unguiculata-sesquipedalis",
      "bitter-melon-momordica-charantia",
      "peanut-arachis-hypogaea",
      "common-purslane-portulaca-oleracea",
    ]) {
      const en = seedProfileForEntry(id, "en");
      const es = seedProfileForEntry(id, "es");
      expect(en?.protocol.length).toBeGreaterThan(0);
      expect(es?.protocol.some((section) => section.title === "Siembra")).toBe(true);
      expect(en?.sources.length).toBeGreaterThan(0);
      expect(en?.sources.every((source) => source.url.startsWith("http"))).toBe(true);
      expect(en?.evidence.needsValidation).toBeGreaterThan(0);
    }
    const peanut = seedProfileForEntry("peanut-arachis-hypogaea", "en");
    expect(JSON.stringify(peanut)).toMatch(/depth conflict|depth differs/i);
    const purslane = seedProfileForEntry("common-purslane-portulaca-oleracea", "en");
    expect(JSON.stringify(purslane)).toMatch(/not germination|no es tiempo de germinación/i);
  });

  it("keeps Wave 21 seed evidence scoped and unresolved fields honest in EN/ES", () => {
    for (const id of [
      "smooth-luffa-luffa-aegyptiaca",
      "new-zealand-spinach-tetragonia-tetragonoides",
      "sweet-corn-zea-mays",
    ]) {
      const en = seedProfileForEntry(id, "en");
      const es = seedProfileForEntry(id, "es");
      expect(en?.protocol.length).toBeGreaterThan(0);
      expect(es?.protocol.some((section) => section.title === "Siembra")).toBe(true);
      expect(en?.sources.length).toBeGreaterThan(0);
      expect(en?.sources.every((source) => source.url.startsWith("http"))).toBe(true);
      expect(en?.evidence.needsValidation).toBeGreaterThan(0);
    }
    expect(
      seedProfileForEntry("smooth-luffa-luffa-aegyptiaca", "en")?.metrics,
    ).toHaveLength(0);
    expect(
      JSON.stringify(seedProfileForEntry("sweet-corn-zea-mays", "en")),
    ).toMatch(/60°F|65°F/);
  });

  it("localizes profile identity and protocol text without changing its identity", () => {
    const entry = findCanonicalEntry("genovese-basil");
    const profile = entry ? buildSeedProfile(entry, "es") : null;

    expect(profile?.plantIdentityId).toBe("genovese-basil");
    expect(profile?.name).toBe("Genovese Basil");
    expect(profile?.spanishName).toBe("Albahaca genovesa");
    expect(profile?.summary).not.toBe(profile?.protocol[0]?.body);
    expect(profile?.protocol[0]?.title).toBeTruthy();
  });

  it("labels low-specificity starter content honestly instead of presenting it as packet guidance", () => {
    const english = seedProfileForEntry("arugula", "en");
    const spanish = seedProfileForEntry("arugula", "es");

    expect(english?.contentLevel).toBe("crop_level_baseline");
    expect(english?.summary).toMatch(/crop-level baseline/i);
    expect(english?.summary).toMatch(/packet-specific instructions/i);
    expect(spanish?.contentLevel).toBe("crop_level_baseline");
    expect(spanish?.summary).toMatch(/guía base a nivel de cultivo/i);
    expect(spanish?.summary).toMatch(/instrucciones del paquete/i);
  });

  it("preserves scoped winter-squash seed facts and leaves unsupported timing unresolved", () => {
    const profile = seedProfileForEntry("acorn-squash", "en");
    const temperature = profile?.metrics.find((metric) => metric.key === "temperature");
    const depth = profile?.metrics.find((metric) => metric.key === "depth");
    const germination = profile?.metrics.find((metric) => metric.key === "germination");

    expect(temperature?.value).toMatch(/62°F.*70°F/);
    expect(temperature?.sourceIds).toContain("johnnys-winter-squash-wave3");
    expect(depth?.value).toMatch(/½–1 in/);
    expect(depth?.sourceIds).toContain("johnnys-winter-squash-wave3");
    expect(germination?.evidenceType).toBe("needs_validation");
    expect(germination?.value).toMatch(/pending/i);
    expect(JSON.stringify(profile)).not.toMatch(/cultivar-specific germination/i);
  });

  it("keeps tomato and pepper seed guidance at crop scope without extending Capsicum annuum facts to Habanero", () => {
    const tomato = seedProfileForEntry("grape-tomato", "en");
    const tomatoGermination = tomato?.metrics.find((metric) => metric.key === "germination");
    const tomatoDepth = tomato?.metrics.find((metric) => metric.key === "depth");
    expect(tomatoGermination?.value).toMatch(/5–7 days at crop level/);
    expect(tomatoGermination?.sourceIds).toContain("johnnys-tomato");
    expect(tomatoDepth?.value).toMatch(/¼ in/);
    expect(tomato?.summary).toMatch(/not a guarantee for this named variety or packet/);

    const pepper = seedProfileForEntry("anaheim-pepper", "en");
    const pepperTemperature = pepper?.metrics.find((metric) => metric.key === "temperature");
    expect(pepperTemperature?.value).toMatch(/80°F.*65–75°F/);
    expect(pepperTemperature?.sourceIds).toContain("usu-peppers");

    const habanero = seedProfileForEntry("habanero-pepper", "en");
    const habaneroTemperature = habanero?.metrics.find((metric) => metric.key === "temperature");
    expect(habaneroTemperature?.value).not.toMatch(/80°F/);
    expect(habanero?.summary).not.toMatch(
      /Utah State Extension describes a pepper seed-starting sequence/,
    );
  });

  it("preserves uncertainty in a lower-density profile instead of filling donor slots", () => {
    const profile = seedProfileForEntry("arugula", "en");

    expect(profile).not.toBeNull();
    expect(profile?.evidence.needsValidation).toBeGreaterThan(0);
    expect(JSON.stringify(profile)).not.toContain("URUQ 12");
    expect(JSON.stringify(profile)).not.toContain("User Zero");
    expect(JSON.stringify(profile)).not.toContain("2026-A");
  });

  it("keeps American elderberry seed evidence narrow and bilingual", () => {
    const english = seedProfileForEntry("american-elderberry-sambucus-canadensis", "en");
    const spanish = seedProfileForEntry("american-elderberry-sambucus-canadensis", "es");

    expect(english?.scientificName).toBe("Sambucus canadensis");
    expect(english?.sources.map((source) => source.id)).toContain("ufifas-elderberry-florida-wave44");
    expect(english?.summary).toMatch(/seedlings vary|vary/i);
    expect(JSON.stringify(english)).toMatch(/stratification/i);
    expect(JSON.stringify(english)).not.toMatch(/\b\d+\s*(?:days|weeks|°F|°C)\b/i);
    expect(english?.evidence.needsValidation).toBeGreaterThan(0);
    expect(spanish?.protocol.some((section) => section.title === "Siembra")).toBe(true);
    expect(spanish?.sources.map((source) => source.id)).toContain("ufifas-elderberry-florida-wave44");
  });

  it("does not expose deferred or private inventory as public Seed Profiles", () => {
    expect(seedProfileForEntry("italian-oregano", "en")).toBeNull();
    expect(JSON.stringify(buildSeedProfiles("en"))).not.toMatch(
      /"(packetName|purchaseYear|germinationRatePct|purityPct|userId|sowings)"/,
    );
    expect(JSON.stringify(buildSeedProfiles("en"))).not.toContain("User Zero");
    const publicProfiles = JSON.stringify(buildSeedProfiles("en"));
    expect(publicProfiles).not.toMatch(/owned (?:seed|packet|material)/i);
  });
});
