import { describe, expect, it } from "vitest";
import { gardenPlantProfileCatalog } from "@/generated/garden-plant-profile-index";

import {
  buildDonorPlantDetail,
  canonicalEntries,
  donorPlants,
  donorPlantsById,
  findCanonicalEntry,
  normalizeLightFilter,
  normalizeOutdoorExposureFilter,
} from "./canonical-adapter";
import { filterDonorPlants, getCatalogPage } from "./explore";
import { calculateSingleCropDose } from "./hydro-calculator.engine";
import { getPlantRecommendations } from "./plant-advisor.service";

describe("direct Gardenpedia presentation adapter", () => {
  it("publishes a structured bilingual profile for every canonical identity", () => {
    const profileIds = Object.keys(gardenPlantProfileCatalog).sort();
    const identityIds = canonicalEntries.map((entry) => entry.libraryPlantId).sort();

    expect(profileIds).toEqual(identityIds);
    for (const profile of Object.values(gardenPlantProfileCatalog)) {
      expect(profile.summary.en.trim()).not.toBe("");
      expect(profile.summary.es.trim()).not.toBe("");
      expect(profile.metrics.en).toHaveLength(profile.metrics.es.length);
    }
  });

  it("exposes the new cover-crop category as a real canonical Explore filter", () => {
    const coverCrops = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "cover crops",
      inventory: "all",
    });

    expect(coverCrops.map((plant) => plant.id)).toEqual(
      expect.arrayContaining([
        "buckwheat-fagopyrum-esculentum",
        "crimson-clover-trifolium-incarnatum",
        "white-clover-trifolium-repens",
        "cereal-rye-secale-cereale",
        "oats-avena-sativa",
      ]),
    );
    expect(coverCrops).toHaveLength(5);
  });

  it("keeps the published fruiting category filterable through its shared fruits key", () => {
    const fruiting = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "fruits",
      inventory: "all",
    });
    expect(fruiting.length).toBeGreaterThan(0);
    expect(fruiting.every((plant) => plant.categoryKey === "fruits")).toBe(true);
    expect(fruiting.some((plant) => plant.category === "fruiting")).toBe(true);
  });

  it("adapts the complete active canonical catalog without changing identity ids", () => {
    expect(canonicalEntries.length).toBeGreaterThanOrEqual(500);
    expect(new Set(donorPlants.map((plant) => plant.id)).size).toBe(canonicalEntries.length);
    expect(donorPlants.map((plant) => plant.id)).toContain("genovese-basil");
    expect(donorPlants.map((plant) => plant.id)).toContain("cascading-petunia");
    expect(donorPlants.map((plant) => plant.id)).toEqual(
      expect.arrayContaining([
        "smooth-luffa-luffa-aegyptiaca",
        "new-zealand-spinach-tetragonia-tetragonoides",
        "sweet-corn-zea-mays",
        "sweet-potato-ipomoea-batatas",
        "potato-solanum-tuberosum",
        "garlic-allium-sativum",
        "ginger-zingiber-officinale",
        "turmeric-curcuma-longa",
        "celeriac-apium-graveolens",
        "radicchio-cichorium-intybus",
        "jicama-pachyrhizus-erosus",
        "scarlet-runner-bean-phaseolus-coccineus",
        "chickpea-cicer-arietinum",
        "lentil-vicia-lens",
        "southern-pea-vigna-unguiculata",
        "mung-bean-vigna-radiata",
        "hoja-santa-piper-auritum",
        "tong-hao-glebionis-coronaria",
        "honeydew-melon-cucumis-melo",
        "lemon-verbena-aloysia-citrodora",
        "cuban-oregano-coleus-amboinicus",
        "purple-shamrock-oxalis-triangularis",
        "arrowhead-plant-syngonium-podophyllum",
        "baby-rubber-plant-peperomia-obtusifolia",
        "satin-pothos-scindapsus-pictus",
        "chinese-money-plant-pilea-peperomioides",
      ]),
    );
  });

  it("builds a bilingual public Plant Detail for every active catalog identity", () => {
    for (const entry of canonicalEntries) {
      const english = buildDonorPlantDetail(entry, "en");
      const spanish = buildDonorPlantDetail(entry, "es");
      expect(english.id).toBe(entry.libraryPlantId);
      expect(spanish.id).toBe(entry.libraryPlantId);
      expect(english.summary.trim()).not.toBe("");
      expect(spanish.summary.trim()).not.toBe("");
      expect(spanish.metrics).toHaveLength(english.metrics.length);
      expect(english.guides.length).toBeGreaterThan(0);
      expect(spanish.guides.length).toBeGreaterThan(0);
    }
  });

  it("keeps fenugreek's mature seed-production metric while excluding seed-starting data", () => {
    const entry = findCanonicalEntry("common-fenugreek-trigonella-foenum-graecum");
    expect(entry).toBeDefined();
    const english = buildDonorPlantDetail(entry!, "en");
    const spanish = buildDonorPlantDetail(entry!, "es");

    expect(english.metrics.map((metric) => metric.label)).toEqual([
      "Mature height",
      "Ontario field context",
      "Herb harvest",
      "Seed production",
    ]);
    expect(spanish.metrics.map((metric) => metric.label)).toEqual([
      "Altura adulta",
      "Contexto de campo en Ontario",
      "Cosecha de hierba",
      "Producción de semilla",
    ]);
    expect(english.metrics.some((metric) => /germination|sowing|seedling/i.test(metric.label))).toBe(
      false,
    );
    expect(spanish.metrics.some((metric) => /germinación|siembra|plántula/i.test(metric.label))).toBe(
      false,
    );
  });

  it("shows garlic's conditional scape and soil-care guidance in both languages", () => {
    const entry = findCanonicalEntry("garlic-allium-sativum")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const enCare = english.guides.find((guide) => guide.id === "care");
    const esCare = spanish.guides.find((guide) => guide.id === "care");

    expect(enCare?.body).toMatch(/if it forms.*redirect more energy toward the bulb/i);
    expect(enCare?.body).toMatch(/first two months.*shallow cultivation/i);
    expect(enCare?.sources.map((source) => source.url)).toContain(
      "https://extension.usu.edu/yardandgarden/research/garlic-in-the-garden",
    );
    expect(esCare?.body).toMatch(/si aparece un tallo floral/i);
    expect(esCare?.body).toMatch(/dos primeros meses.*cultivo superficial/i);
    expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
  });

  it("preserves species-specific dead-stem habitat guidance for smooth blackberry", () => {
    const entry = findCanonicalEntry("blackberry-rubus-canadensis")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const enMaintenance = english.guides.find((guide) => guide.id === "maintenance");
    const esMaintenance = spanish.guides.find((guide) => guide.id === "maintenance");

    expect(enMaintenance?.body).toMatch(/native bees.*dead, hollow stems.*12–24 inches/i);
    expect(enMaintenance?.body).toMatch(/not justify cutting living canes/i);
    expect(enMaintenance?.sources.map((source) => source.url)).toContain(
      "https://plants.ces.ncsu.edu/plants/rubus-canadensis/common-name/blackberry/",
    );
    expect(esMaintenance?.body).toMatch(/abejas nativas.*tallos muertos y huecos.*12–24 pulgadas/i);
    expect(esMaintenance?.body).toMatch(/no justifica cortar cañas vivas/i);
  });

  it("renders Spanish plant-guide subtitles only when editorially supplied", () => {
    const alice = buildDonorPlantDetail(findCanonicalEntry("alice-sundew-drosera-aliciae")!, "es");
    for (const [sectionId, expectedSubtitle] of [
      ["identity", "Especie aceptada: Drosera aliciae"],
      ["cultivation", "Necesita luz abundante, humedad y agua baja en minerales"],
      ["propagation", "Semilla fresca y esquejes son métodos documentados"],
      ["problems", "Revisa la humedad y la calidad del agua antes de intervenir"],
    ]) {
      expect(alice.guides.find((guide) => guide.id === sectionId)?.subtitle).toBe(expectedSubtitle);
    }

    const lessLocalized = buildDonorPlantDetail(
      findCanonicalEntry("tennessee-coneflower-echinacea-tennesseensis")!,
      "es",
    );
    const identity = lessLocalized.guides.find((guide) => guide.id === "identity");
    expect(identity?.subtitle).toBe("");
    expect(identity?.body).toBeTruthy();
    expect(identity?.body).not.toBe(identity?.subtitle);
  });

  it("derives Evidence Health from public Plant Profile sections across rich and pending profiles", () => {
    for (const entry of canonicalEntries) {
      const profile = (
        gardenPlantProfileCatalog as Record<
          string,
          { sections: Record<string, { evidenceType: string }> }
        >
      )[entry.libraryPlantId];
      const english = buildDonorPlantDetail(entry, "en");
      const spanish = buildDonorPlantDetail(entry, "es");
      const backed = Object.values(profile.sections).filter(
        (section) => section.evidenceType === "source_backed",
      ).length;
      const adapted = Object.values(profile.sections).filter(
        (section) => section.evidenceType === "garden_adaptation",
      ).length;
      const pending = Object.values(profile.sections).filter(
        (section) => section.evidenceType === "needs_validation",
      ).length;
      const assessed = Object.keys(profile.sections).length;

      expect(english.evidence).toMatchObject({ backed, adapted, pending });
      expect(english.evidence.coverage).toBe(`${backed}/${assessed} units`);
      expect(spanish.evidence).toMatchObject({ backed, adapted, pending });
      expect(spanish.evidence.coverage).toBe(`${backed}/${assessed} unidades`);
    }

    const fenugreek = buildDonorPlantDetail(
      findCanonicalEntry("common-fenugreek-trigonella-foenum-graecum")!,
      "en",
    );
    expect(fenugreek.evidence).toMatchObject({
      backed: 8,
      adapted: 0,
      pending: 0,
      coverage: "8/8 units",
    });

    const unresolved = buildDonorPlantDetail(findCanonicalEntry("italian-oregano")!, "en");
    expect(unresolved.evidence).toMatchObject({
      backed: 0,
      adapted: 0,
      pending: 1,
      coverage: "0/1 units",
    });
  });

  it("searches canonical names without accent or case sensitivity", () => {
    const results = filterDonorPlants({
      plants: donorPlants,
      query: "ARANDANO",
      category: "all",
      inventory: "all",
    });
    expect(results.map((plant) => plant.id)).toContain("northern-highbush-blueberry");
  });

  it("finds botanical coverage aliases without creating duplicate identities", () => {
    const greenTatsoi = filterDonorPlants({
      plants: donorPlants,
      query: "Green Tatsoi",
      category: "all",
      inventory: "all",
    });
    const bunchingOnions = filterDonorPlants({
      plants: donorPlants,
      query: "Bunching Onions",
      category: "all",
      inventory: "all",
    });

    expect(greenTatsoi.map((plant) => plant.id)).toEqual(["tatsoi"]);
    expect(bunchingOnions.map((plant) => plant.id)).toEqual(["bunching-onion-allium-fistulosum"]);
  });

  it("progressively renders a large catalog without dropping searchable entries", () => {
    const items = Array.from({ length: 500 }, (_, index) => `plant-${index + 1}`);
    const firstPage = getCatalogPage(items, 48);
    const laterPage = getCatalogPage(items, 96);
    const finalPage = getCatalogPage(items, 600);

    expect(firstPage.visible).toHaveLength(48);
    expect(firstPage.hasMore).toBe(true);
    expect(laterPage.visible).toHaveLength(96);
    expect(laterPage.hasMore).toBe(true);
    expect(finalPage.visible).toHaveLength(500);
    expect(finalPage.hasMore).toBe(false);
  });

  it("keeps every active identity addressable through the shared Plant Detail renderer", () => {
    for (const entry of canonicalEntries) {
      const detail = buildDonorPlantDetail(entry, "en");
      expect(detail.id).toBe(entry.libraryPlantId);
      expect(detail.name).toBeTruthy();
      expect(detail.summary).toBeTruthy();
      expect(
        detail.guides.length,
        `${entry.libraryPlantId} should render its available public facts or explicit guidance gaps`,
      ).toBeGreaterThan(0);
      expect(
        detail.guides.every((guide) =>
          guide.sources.every((source) => /^https?:\/\//.test(source.url)),
        ),
      ).toBe(true);
    }
  });

  it("renders Wave 38 identities with canonical evidence and no invented hydroponic fit", () => {
    for (const id of [
      "bird-of-paradise-strelitzia-reginae",
      "string-of-hearts-ceropegia-woodii",
      "string-of-pearls-curio-rowleyanus",
      "ripple-peperomia-peperomia-caperata",
      "panda-plant-kalanchoe-tomentosa",
    ]) {
      const entry = findCanonicalEntry(id)!;
      const detail = buildDonorPlantDetail(entry, "en");
      expect(detail.id).toBe(id);
      expect(detail.scientificName).toBeTruthy();
      expect(detail.guides.length).toBeGreaterThan(0);
      expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
    }
  });

  it("renders Wave 39 houseplants with their exact taxonomic scope and unresolved hydroponic fit", () => {
    for (const id of [
      "philippine-evergreen-aglaonema-commutatum",
      "giant-white-bird-of-paradise-strelitzia-nicolai",
      "madagascar-dragon-tree-dracaena-reflexa-angustifolia",
      "gold-dust-dracaena-dracaena-surculosa",
    ]) {
      const entry = findCanonicalEntry(id)!;
      const detail = buildDonorPlantDetail(entry, "en");
      expect(detail.id).toBe(id);
      expect(detail.scientificName).toBeTruthy();
      expect(detail.guides.length).toBeGreaterThan(0);
      expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
      expect(detail.guides.flatMap((guide) => guide.sources).length).toBeGreaterThan(0);
    }
  });

  it("renders Wave 40 public profiles while keeping context-specific facts scoped", () => {
    for (const id of [
      "ponytail-palm-beaucarnea-recurvata",
      "cape-jasmine-gardenia-jasminoides",
      "chinese-hibiscus-hibiscus-rosa-sinensis",
      "roselle-sabdariffa-gossypiifolia",
      "rose-of-sharon-hibiscus-syriacus",
    ]) {
      const entry = findCanonicalEntry(id)!;
      const detail = buildDonorPlantDetail(entry, "en");
      expect(detail.id).toBe(id);
      expect(detail.scientificName).toBeTruthy();
      expect(detail.guides.length).toBeGreaterThan(0);
      expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
    }
    expect(findCanonicalEntry("roselle-sabdariffa-gossypiifolia")?.scientificName).toBe(
      "Sabdariffa gossypiifolia",
    );
  });

  it("renders Wave 41 houseplants with supported identity and honest capability gaps", () => {
    const expected = [
      ["polka-dot-plant-hypoestes-phyllostachya", "Hypoestes phyllostachya"],
      ["purple-heart-tradescantia-pallida", "Tradescantia pallida"],
      ["wax-plant-hoya-pubicalyx", "Hoya pubicalyx"],
      ["common-staghorn-fern-platycerium-bifurcatum", "Platycerium bifurcatum"],
      ["delta-maidenhair-fern-adiantum-raddianum", "Adiantum raddianum"],
      ["scarlet-star-guzmania-lingulata", "Guzmania lingulata"],
      ["thanksgiving-cactus-schlumbergera-truncata", "Schlumbergera truncata"],
      ["arabian-jasmine-jasminum-sambac", "Jasminum sambac"],
    ] as const;
    for (const [id, scientificName] of expected) {
      const entry = findCanonicalEntry(id)!;
      expect(entry).toBeTruthy();
      expect(entry.scientificName).toBe(scientificName);
      expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
      expect(buildDonorPlantDetail(entry, "en").guides.length).toBeGreaterThan(0);
    }
  });

  it("searches canonical English, Spanish, scientific and alias fields", () => {
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "tomillo alemán",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("german-thyme");
    const genericBasil = filterDonorPlants({
      plants: donorPlants,
      query: "basil",
      category: "herbs",
      outdoorExposure: "all",
      inventory: "all",
    });
    expect(genericBasil.every((plant) => plant.category === "herbs")).toBe(true);
    expect(genericBasil.map((plant) => plant.id)).toEqual(
      expect.arrayContaining(["basil-ocimum-basilicum", "sweet-basil", "genovese-basil"]),
    );
    const specificGenovese = filterDonorPlants({
      plants: donorPlants,
      query: "Genovese Basil",
      category: "all",
      outdoorExposure: "all",
      inventory: "all",
    });
    expect(specificGenovese.map((plant) => plant.id)).toEqual(["genovese-basil"]);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "Petunia × atkinsiana",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("cascading-petunia");
  });

  it("covers the supplied botanical reference identities without conflating distinct crops", () => {
    const requiredIds = [
      "culantro",
      "epazote",
      "papalo-porophyllum-ruderale",
      "tiny-tim-tomato",
      "monterey-strawberry",
      "mini-lunchbox-sweet-pepper",
      "orange-hat-micro-dwarf-tomato",
      "micro-tom-tomato",
      "green-salanova-lettuce",
      "bronze-arrow-lettuce",
      "breen-romaine-lettuce",
      "romaine-lettuce",
      "red-romaine-lettuce",
      "basil-ocimum-basilicum",
      "genovese-basil",
      "chinese-light-green-celery",
      "pinguicula-weser",
      "pinguicula-lilac-lollipop",
      "alice-sundew-drosera-aliciae",
      "cape-sundew-drosera-capensis",
      "nepenthes-x-ventrata",
    ];
    expect(canonicalEntries.map((entry) => entry.libraryPlantId)).toEqual(
      expect.arrayContaining(requiredIds),
    );
    const culantroResults = filterDonorPlants({
      plants: donorPlants,
      query: "culantro",
      category: "all",
      outdoorExposure: "all",
      inventory: "all",
    });
    expect(culantroResults.map((plant) => plant.id)).toContain("culantro");
    expect(culantroResults.map((plant) => plant.id)).not.toContain("cilantro");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "chinese celery",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("chinese-light-green-celery");
  });

  it("keeps mini sweet pepper at an unnamed horticultural-type scope", () => {
    const entry = findCanonicalEntry("mini-lunchbox-sweet-pepper")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");

    expect(entry.scientificName).toBe("Capsicum annuum");
    expect(entry.cultivar).toMatch(/no named cultivar assigned/i);
    expect(english.guides.find((guide) => guide.id === "identity")?.body).toMatch(
      /unnamed horticultural type.*not as a named cultivar/i,
    );
    expect(english.metrics.map((metric) => metric.value).join(" ")).not.toMatch(
      /55–63|75–83/,
    );
    expect(spanish.guides.find((guide) => guide.id === "identity")?.body).toMatch(
      /tipo hortícola sin nombre de cultivar/i,
    );
    expect(entry.compatibilityProfile?.matureSize?.height?.status).toBe("unknown");
  });

  it("publishes Wave 37 houseplants with bilingual evidence and no invented hydroponic fit", () => {
    const ids = [
      "goeppertia-orbifolia",
      "croton-codiaeum-variegatum",
      "florist-kalanchoe-kalanchoe-blossfeldiana",
      "dwarf-umbrella-tree-heptapleurum-arboricola",
      "weeping-fig-ficus-benjamina",
    ];
    for (const id of ids) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en");
      const spanish = buildDonorPlantDetail(entry, "es");
      expect(english.scientificName).toBeTruthy();
      expect(english.summary).toBeTruthy();
      expect(spanish.spanishName).not.toBe(english.name);
      expect(spanish.summary).not.toBe(english.summary);
      expect(english.guides.every((guide) => guide.sources.length > 0)).toBe(true);
      expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
    }
    expect(
      buildDonorPlantDetail(
        findCanonicalEntry("florist-kalanchoe-kalanchoe-blossfeldiana")!,
        "es",
      ).guides.map((guide) => guide.title),
    ).toContain("Seguridad");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "calathea orbifolia",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("goeppertia-orbifolia");
  });

  it("filters and localizes the legumes category for the new crop identities", () => {
    const legumes = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "legumes",
      outdoorExposure: "all",
      inventory: "all",
    });

    expect(legumes.map((plant) => plant.id)).toEqual(
      expect.arrayContaining([
        "scarlet-runner-bean-phaseolus-coccineus",
        "chickpea-cicer-arietinum",
        "lentil-vicia-lens",
      ]),
    );
    expect(legumes.every((plant) => plant.categoryKey === "legumes")).toBe(true);
  });

  it("supports category and public inventory boundaries", () => {
    const flowers = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "flowers",
      outdoorExposure: "all",
      inventory: "all",
    });
    expect(flowers.length).toBeGreaterThan(0);
    expect(flowers.every((plant) => plant.category === "flowers")).toBe(true);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        outdoorExposure: "all",
        inventory: "owned",
      }),
    ).toHaveLength(0);

    const fullSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "full_sun",
      inventory: "all",
    });
    const partialSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "partial_sun",
      inventory: "all",
    });
    const unknownLight = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "unknown",
      inventory: "all",
    });
    expect(fullSun.length).toBe(224);
    expect(partialSun.length).toBe(11);
    expect(unknownLight).toHaveLength(
      donorPlants.filter((plant) => plant.outdoorExposures.includes("unknown")).length,
    );
    expect(fullSun.every((plant) => plant.outdoorExposures.includes("full_sun"))).toBe(true);
    expect(partialSun.every((plant) => plant.outdoorExposures.includes("partial_sun"))).toBe(true);
    expect(unknownLight.every((plant) => plant.outdoorExposures.includes("unknown"))).toBe(true);
    const highLight = donorPlants.filter((plant) => plant.lightRequirement === "high");
    const mediumLight = donorPlants.filter((plant) => plant.lightRequirement === "medium");
    const lowLight = donorPlants.filter((plant) => plant.lightRequirement === "low");
    const unknownLightRequirement = donorPlants.filter(
      (plant) => plant.lightRequirement === "unknown",
    );
    expect(highLight.map((plant) => plant.id)).toEqual(["genovese-basil"]);
    expect(mediumLight).toHaveLength(0);
    expect(donorPlants.find((plant) => plant.id === "common-mint")?.lightRequirement).toBe(
      "unknown",
    );
    expect(lowLight).toHaveLength(0);
    expect(unknownLightRequirement).toHaveLength(
      donorPlants.filter((plant) => plant.lightRequirement === "unknown").length,
    );
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "ornamentals",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toEqual(
      expect.arrayContaining([
        "venus-flytrap-dionaea-muscipula",
        "cape-sundew-drosera-capensis",
        "pinguicula-primuliflora",
        "nepenthes-x-ventrata",
      ]),
    );
    expect(donorPlants.find((plant) => plant.id === "tiny-tim-tomato")?.lightRequirement).toBe(
      "unknown",
    );
    expect(donorPlants.find((plant) => plant.id === "red-romaine-lettuce")?.lightRequirement).toBe(
      "unknown",
    );
    expect(donorPlants.find((plant) => plant.id === "genovese-basil")?.lightRequirement).toBe(
      "high",
    );
    expect(donorPlants.find((plant) => plant.id === "common-mint")?.lightRequirement).toBe(
      "unknown",
    );
    expect(
      donorPlants.find((plant) => plant.id === "delphinium-magic-fountains-dwarf")
        ?.lightRequirement,
    ).toBe("unknown");
    expect(normalizeLightFilter("high light")).toBe("high");
    expect(normalizeLightFilter("luz media")).toBe("medium");
    expect(normalizeLightFilter("low light")).toBe("low");
    expect(normalizeLightFilter("any light")).toBe("all");
    expect(normalizeOutdoorExposureFilter("partial shade")).toBe("partial_shade");
    expect(normalizeOutdoorExposureFilter("full sun")).toBe("full_sun");
    expect(normalizeOutdoorExposureFilter("low light")).toBeNull();
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        outdoorExposure: "partial shade",
        inventory: "all",
      }),
    ).toHaveLength(2);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        light: "high",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toEqual(["genovese-basil"]);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "herbs",
        indoorLight: "all",
        outdoorExposure: "partial_sun",
        inventory: "all",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "herbs",
        light: "low",
        outdoorExposure: "all",
        inventory: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "leafy greens",
        light: "medium",
        outdoorExposure: "all",
        inventory: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        light: "high",
        inventory: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        light: "medium",
        outdoorExposure: "partial_sun",
        inventory: "all",
      }),
    ).toHaveLength(0);
    const partialShade = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      indoorLight: "all",
      outdoorExposure: "partial_shade",
      inventory: "all",
    });
    expect(partialShade).toHaveLength(2);
    expect(partialShade.map((plant) => plant.id)).toEqual(
      expect.arrayContaining(["delphinium-magic-fountains-dwarf", "zinnia-lilliput-mixed"]),
    );
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        indoorLight: "all",
        outdoorExposure: "shade",
        inventory: "all",
      }),
    ).toHaveLength(0);
  });

  it("keeps a high-data reference and a lower/uncertain identity generic", () => {
    const basil = buildDonorPlantDetail(findCanonicalEntry("genovese-basil")!, "en");
    const oregano = buildDonorPlantDetail(findCanonicalEntry("italian-oregano")!, "en");
    expect(basil.id).toBe("genovese-basil");
    expect(basil.summary).toContain("productive");
    expect(basil.guides.length).toBeGreaterThanOrEqual(6);
    expect(basil.harvestUse?.options.length).toBeGreaterThan(0);
    expect(basil.seedProfileAvailable).toBe(true);
    expect(basil.evidence.coverage).toMatch(/units/);
    const spanishBasil = buildDonorPlantDetail(findCanonicalEntry("genovese-basil")!, "es");
    expect(spanishBasil.summary).toContain("productiva");
    expect(
      basil.guides.every((guide) => guide.sources.every((source) => source.url.startsWith("http"))),
    ).toBe(true);
    expect(oregano.id).toBe("italian-oregano");
    expect(oregano.summary).not.toContain("Genovese");
    expect(
      oregano.guides.some((guide) => guide.backing === "pending") || oregano.evidence.pending > 0,
    ).toBe(true);
  });

  it("renders the sourced fenugreek growth and Harvest Use facts instead of false missing-data placeholders", () => {
    const entry = findCanonicalEntry("common-fenugreek-trigonella-foenum-graecum")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const growth = english.guides.find((guide) => guide.id === "growth");
    const spanishGrowth = spanish.guides.find((guide) => guide.id === "growth");

    expect(english.harvestUse?.ediblePart).toMatch(/green plant parts.*mature seeds/i);
    expect(english.harvestUse?.bestUse).toMatch(/does not specify a universal harvest date/i);
    expect(english.harvestUse?.quickUses).toContain("Curries (seeds)");
    expect(english.harvestUse?.options[0]?.sources).toEqual([
      expect.objectContaining({
        label: expect.stringContaining("North Carolina State University Extension"),
        url: "https://plants.ces.ncsu.edu/plants/trigonella-foenum-graecum/common-name/fenugreek/",
      }),
    ]);
    expect(growth?.body).toMatch(/1 ft 3 in–2 ft tall/);
    expect(growth?.sources).toHaveLength(1);
    expect(growth?.sources[0]?.label).toContain("North Carolina State University Extension");
    expect(spanish.harvestUse?.ediblePart).toMatch(/Partes verdes.*semillas maduras/);
    expect(spanishGrowth?.body).toMatch(/especie anual erecta/);
    expect(spanishGrowth?.body).not.toContain("1 ft 3 in");
  });

  it("renders limited, safety-scoped pansy petal use with bilingual source attribution", () => {
    const entry = findCanonicalEntry("viola-pansy")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse;

    expect(english?.ediblePart).toMatch(/petals.*grown as an edible flower/i);
    expect(english?.options[0]?.steps).toEqual(
      expect.arrayContaining([expect.stringMatching(/do not assume.*ornamental nursery plant/i)]),
    );
    expect(english?.options[0]?.sources).toEqual([
      expect.objectContaining({
        label: expect.stringContaining("Texas A&M AgriLife Extension Service"),
        url: "https://aggie-horticulture.tamu.edu/vegetable/guides/specialty-vegetables/edible-flowers/",
      }),
    ]);
    expect(english?.safetyNote).toMatch(/unknown treatment history/i);
    expect(spanish?.ediblePart).toMatch(/Pétalos.*cultivado como flor comestible/i);
    expect(spanish?.safetyNote).toMatch(/pensamientos ornamentales.*tratamiento desconocido/i);
  });

  it("preserves the Moss Rose food-use source conflict without publishing a consumption recommendation", () => {
    const entry = findCanonicalEntry("moss-rose-portulaca-grandiflora")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const englishUse = english.guides.find((guide) => guide.id === "uses");
    const spanishUse = spanish.guides.find((guide) => guide.id === "uses");

    expect(english.summary).toMatch(/sources conflict.*no food-use recommendation/i);
    expect(spanish.summary).toMatch(/fuentes discrepan.*no recomienda su consumo/i);
    expect(englishUse?.backing).toBe("pending");
    expect(englishUse?.body).toMatch(/NC State.*edible.*UF\/IFAS.*not edible/i);
    expect(spanishUse?.backing).toBe("pending");
    expect(spanishUse?.body).toMatch(/NC State.*comestibles.*UF\/IFAS.*no es comestible/i);
    expect(english.harvestUse).toBeUndefined();
  });

  it("preserves White Carolina pollination disagreement while rendering the scoped practical recommendation in EN/ES", () => {
    const entry = findCanonicalEntry("white-carolina-pineberry")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const enPollination = english.guides.find((guide) => guide.id === "pollination");
    const esPollination = spanish.guides.find((guide) => guide.id === "pollination");
    const enPending = english.guides.find((guide) => guide.id === "needsValidation");

    expect(enPollination?.backing).toBe("garden");
    expect(enPollination?.body).toMatch(/Walters Gardens recommends one everbearing variety per five plants/i);
    expect(enPollination?.sources.some((source) => source.label.includes("Walters Gardens"))).toBe(true);
    expect(enPollination?.body).toMatch(/Raintree.*self-fertile/i);
    expect(esPollination?.body).toMatch(/Walters Gardens recomienda una variedad everbearing.*por cada cinco plantas/i);
    expect(esPollination?.body).toMatch(/Raintree llama autofértil/i);
    expect(enPending?.backing).toBe("pending");
    expect(english.id).toBe("white-carolina-pineberry");
  });

  it("renders species-appropriate orchard-fruit Harvest Use in English and Spanish with resolving sources", () => {
    const identities = [
      "european-pear-pyrus-communis",
      "european-plum-prunus-domestica",
      "japanese-plum-prunus-salicina",
      "sour-cherry-prunus-cerasus",
      "sweet-cherry-prunus-avium",
      "hardy-kiwi-actinidia-arguta",
    ];

    for (const id of identities) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en").harvestUse;
      const spanish = buildDonorPlantDetail(entry, "es").harvestUse;

      expect(english?.ediblePart).not.toMatch(/not established/i);
      expect(english?.bestUse.length).toBeGreaterThan(40);
      expect(english?.options.length).toBeGreaterThan(0);
      expect(spanish?.ediblePart).not.toMatch(/no establecida/i);
      expect(spanish?.bestUse.length).toBeGreaterThan(40);
      expect(spanish?.options.length).toBe(english?.options.length);
      expect(english?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(spanish?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(
        english?.options
          .flatMap((option) => option.sources)
          .every((source) => source.url.startsWith("https://")),
      ).toBe(true);
    }

    const sourCherry = buildDonorPlantDetail(findCanonicalEntry("sour-cherry-prunus-cerasus")!, "en").harvestUse!;
    const sweetCherry = buildDonorPlantDetail(findCanonicalEntry("sweet-cherry-prunus-avium")!, "en").harvestUse!;
    expect(sourCherry.options.map((option) => option.title).join(" ")).toMatch(/sour cherries/i);
    expect(sweetCherry.options.map((option) => option.title).join(" ")).toMatch(/sweet cherries/i);
  });

  it("renders crop-scoped Harvest Use for Honey Bear, Patio Tomato, and stalk celery in EN/ES", () => {
    const cases = [
      {
        id: "honey-bear-f1-acorn-squash",
        expectedSource: "University of Illinois Extension",
        scopeBoundary: /not.*Honey Bear-specific|not a Honey Bear-specific/i,
      },
      {
        id: "patio-tomato",
        expectedSource: "Utah State University Extension",
        scopeBoundary: /not a cultivar-specific maturity date|not a cultivar-specific/i,
      },
      {
        id: "stalk-celery-apium-graveolens",
        expectedSource: "Utah State University Extension",
        scopeBoundary: /no universal repeat-harvest interval|not fixed cultivar guarantees/i,
      },
    ];

    for (const { id, expectedSource, scopeBoundary } of cases) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en").harvestUse;
      const spanish = buildDonorPlantDetail(entry, "es").harvestUse;

      expect(english?.bestUse.length).toBeGreaterThan(60);
      expect(spanish?.bestUse.length).toBeGreaterThan(60);
      expect(english?.options.length).toBeGreaterThan(0);
      expect(spanish?.options.length).toBe(english?.options.length);
      expect(english?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(spanish?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(english?.options.flatMap((option) => option.sources).some((source) => source.label.includes(expectedSource))).toBe(true);
      expect(`${english?.bestUse} ${english?.options.map((option) => option.summary).join(" ")}`).toMatch(scopeBoundary);
    }

    const celery = buildDonorPlantDetail(findCanonicalEntry("stalk-celery-apium-graveolens")!, "en").harvestUse!;
    expect(celery.options.map((option) => option.title).join(" ")).toMatch(/outer stalks|freeze celery/i);
    expect(celery.options.flatMap((option) => option.sources).some((source) => source.label.includes("National Center for Home Food Preservation"))).toBe(true);
  });

  it("renders evidence-scoped cut-flower Harvest Use for Stock and Sweet William in EN/ES", () => {
    const cases = [
      {
        id: "stock-matthiola-incana",
        expectedSource: "Mississippi State University Extension Service",
        scopeBoundary: /not a repeat-cut promise|does not establish a home vase-life guarantee/i,
      },
      {
        id: "sweet-william-dianthus-barbatus",
        expectedSource: "University of California, Davis",
        scopeBoundary: /not generalized as home instructions|no home vase-life duration/i,
      },
      {
        id: "annual-babys-breath-gypsophila-elegans",
        expectedSource: "Oklahoma Cooperative Extension Service",
        scopeBoundary: /genus-level|not an exact percent-open target/i,
      },
      {
        id: "ivory-princess-calendula",
        expectedSource: "Oklahoma Cooperative Extension Service",
        scopeBoundary: /species-level|not a trial of the Ivory Princess selection|food-grade/i,
      },
      {
        id: "dwarf-sunflower",
        expectedSource: "University of Illinois Extension",
        scopeBoundary: /species-level advice|not a dwarf-cultivar trial|not.*every dwarf selection/i,
      },
      {
        id: "sweet-pea",
        expectedSource: "University of Illinois Extension",
        scopeBoundary: /half the florets open|about half the florets are open/i,
      },
      {
        id: "blazing-star-liatris-spicata",
        expectedSource: "Oklahoma Cooperative Extension Service",
        scopeBoundary: /direct-sale|does not promise a vase-life duration/i,
      },
    ];

    for (const { id, expectedSource, scopeBoundary } of cases) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en").harvestUse;
      const spanish = buildDonorPlantDetail(entry, "es").harvestUse;

      expect(english?.bestUse.length).toBeGreaterThan(60);
      expect(spanish?.bestUse.length).toBeGreaterThan(60);
      expect(english?.options.length).toBeGreaterThan(0);
      expect(spanish?.options.length).toBe(english?.options.length);
      expect(english?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(spanish?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(english?.options.flatMap((option) => option.sources).some((source) => source.label.includes(expectedSource))).toBe(true);
      expect(`${english?.bestUse} ${english?.options.map((option) => option.summary).join(" ")}`).toMatch(scopeBoundary);
    }

    const sweetPea = buildDonorPlantDetail(findCanonicalEntry("sweet-pea")!, "en").harvestUse!;
    const sweetPeaEs = buildDonorPlantDetail(findCanonicalEntry("sweet-pea")!, "es").harvestUse!;
    expect(sweetPea.safetyNote).toMatch(/pods and seeds are poisonous/i);
    expect(sweetPeaEs.safetyNote).toMatch(/vainas y semillas.*venenosas/i);
  });

  it("renders useful, species-scoped herb and ornamental Harvest Use in EN/ES", () => {
    const cases = [
      {
        id: "sweet-woodruff-galium-odoratum",
        scopeBoundary: /large amounts of flowers|no safe serving amount/i,
      },
      {
        id: "clary-sage-salvia-sclarea",
        scopeBoundary: /does not provide a serving quantity|no amount or recipe/i,
      },
      {
        id: "wild-bergamot-monarda-fistulosa",
        scopeBoundary: /no infusion quantity|not a therapeutic recommendation/i,
      },
      {
        id: "feverfew",
        scopeBoundary: /no universal cutting stage|does not provide medical advice/i,
      },
    ];

    for (const { id, scopeBoundary } of cases) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en").harvestUse;
      const spanish = buildDonorPlantDetail(entry, "es").harvestUse;

      expect(english?.bestUse.length).toBeGreaterThan(60);
      expect(spanish?.bestUse.length).toBeGreaterThan(60);
      expect(english?.options.length).toBeGreaterThan(0);
      expect(spanish?.options.length).toBe(english?.options.length);
      expect(english?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(spanish?.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(`${english?.bestUse} ${english?.options.map((option) => option.summary).join(" ")}`).toMatch(scopeBoundary);
    }

    const sweetWoodruff = buildDonorPlantDetail(findCanonicalEntry("sweet-woodruff-galium-odoratum")!, "en").harvestUse!;
    const clarySage = buildDonorPlantDetail(findCanonicalEntry("clary-sage-salvia-sclarea")!, "en").harvestUse!;
    const feverfew = buildDonorPlantDetail(findCanonicalEntry("feverfew")!, "en").harvestUse!;
    expect(sweetWoodruff.safetyNote).toMatch(/blood-thinning effect/i);
    expect(clarySage.safetyNote).toMatch(/no essential-oil dose/i);
    expect(feverfew.safetyNote).toMatch(/ornamental flower use only/i);
  });

  it("renders asparagus Harvest Use in both languages, including its food-safety note and source links", () => {
    const entry = findCanonicalEntry("asparagus")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.ediblePart).toMatch(/young spears/i);
    expect(english.options).toHaveLength(4);
    expect(english.options[2]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Blanching vegetables") }),
      ]),
    );
    expect(english.options[3]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Asparagus, Spears or Pieces") }),
      ]),
    );
    expect(english.safetyNote).toMatch(/pressure canner/i);
    expect(spanish.ediblePart).toMatch(/turiones jóvenes/i);
    expect(spanish.safetyNote).toMatch(/envasadora a presión/i);
  });

  it("renders bean and pea Harvest Use bilingually without collapsing their crop classes", () => {
    const ids = [
      "bush-bean-blue-lake",
      "bush-bean-royal-burgundy",
      "henderson-bush-lima-bean",
      "kentucky-wonder-pole-bean",
      "little-marvel-shelling-pea",
      "mammoth-melting-sugar-snow-pea",
      "purple-podded-bean",
      "snap-pea-oregon-sugar-pod",
      "sugar-snap-pea",
    ];

    for (const id of ids) {
      const entry = findCanonicalEntry(id)!;
      const en = buildDonorPlantDetail(entry, "en").harvestUse!;
      const es = buildDonorPlantDetail(entry, "es").harvestUse!;
      expect(en.options).toHaveLength(3);
      expect(es.options).toHaveLength(3);
      expect(en.ediblePart.trim()).not.toBe("");
      expect(es.ediblePart.trim()).not.toBe("");
      expect(en.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(es.options.every((option) => option.sources.length > 0)).toBe(true);
      expect(en.options.every((option) => option.title.trim() && option.steps.length > 0)).toBe(true);
      expect(es.options.every((option) => option.title.trim() && option.steps.length > 0)).toBe(true);
    }

    const lima = buildDonorPlantDetail(findCanonicalEntry("henderson-bush-lima-bean")!, "en").harvestUse!;
    const limaEs = buildDonorPlantDetail(findCanonicalEntry("henderson-bush-lima-bean")!, "es").harvestUse!;
    expect(lima.safetyNote).toMatch(/never eat raw lima beans/i);
    expect(limaEs.safetyNote).toMatch(/nunca consumas.*crudos/i);

    const shelling = buildDonorPlantDetail(findCanonicalEntry("little-marvel-shelling-pea")!, "en").harvestUse!;
    const snow = buildDonorPlantDetail(findCanonicalEntry("snap-pea-oregon-sugar-pod")!, "en").harvestUse!;
    const snap = buildDonorPlantDetail(findCanonicalEntry("sugar-snap-pea")!, "en").harvestUse!;
    expect(shelling.bestUse).toMatch(/not as edible-pod peas/i);
    expect(snow.bestUse).toMatch(/not a sugar-snap type/i);
    expect(snap.bestUse).toMatch(/nearly filled/i);
  });

  it("keeps Purple-Podded Bean growth scoped to common bush bean, not fava", () => {
    const entry = findCanonicalEntry("purple-podded-bean")!;
    const en = buildDonorPlantDetail(entry, "en").guides.find((guide) => guide.id === "growth");
    const es = buildDonorPlantDetail(entry, "es").guides.find((guide) => guide.id === "growth");

    expect(en?.body).toMatch(/bush beans as upright plants/i);
    expect(en?.body).not.toMatch(/fava|Vicia faba/i);
    expect(es?.body).toMatch(/frijoles de mata/i);
    expect(es?.body).not.toMatch(/haba|Vicia faba/i);
  });

  it("keeps Harvest Use crop-scoped for arugula, bok choy, and Detroit Dark Red beet", () => {
    const arugula = buildDonorPlantDetail(findCanonicalEntry("arugula")!, "en").harvestUse!;
    const arugulaEs = buildDonorPlantDetail(findCanonicalEntry("arugula")!, "es").harvestUse!;
    const bokChoy = buildDonorPlantDetail(findCanonicalEntry("bok-choy")!, "en").harvestUse!;
    const bokChoyEs = buildDonorPlantDetail(findCanonicalEntry("bok-choy")!, "es").harvestUse!;
    const beet = buildDonorPlantDetail(findCanonicalEntry("beet-detroit-dark-red")!, "en").harvestUse!;
    const beetEs = buildDonorPlantDetail(findCanonicalEntry("beet-detroit-dark-red")!, "es").harvestUse!;

    expect(arugula.bestUse).toMatch(/Eruca sativa/);
    expect(arugulaEs.options[0]?.sources[0]?.label).toContain("University of Wisconsin");
    expect(bokChoy.quickUses).toContain("Kimchi");
    expect(bokChoyEs.quickUses).toContain("Kimchi");
    expect(beet.bestUse).toMatch(/does not establish Detroit Dark Red-specific culinary traits/i);
    expect(beet.options[0]?.sources[0]?.label).toContain("Utah State University Extension");
    expect(beetEs.bestUse).toMatch(/no establece rasgos culinarios propios de Detroit Dark Red/i);
  });

  it("renders the new Gai Lan, cauliflower, Greek oregano, and Lacinato Harvest Use in EN/ES with scoped sources", () => {
    const cases = [
      {
        id: "gai-lan",
        enSource: "Ontario Ministry of Agriculture",
        esSource: "Ontario Ministry of Agriculture",
      },
      {
        id: "cauliflower-snowball",
        enSource: "University of Minnesota Extension",
        esSource: "University of Minnesota Extension",
      },
      {
        id: "greek-oregano",
        enSource: "North Carolina State",
        esSource: "North Carolina State",
      },
      {
        id: "lacinato-kale",
        enSource: "Oregon State University",
        esSource: "Oregon State University",
      },
    ];

    for (const item of cases) {
      const entry = findCanonicalEntry(item.id)!;
      const en = buildDonorPlantDetail(entry, "en").harvestUse!;
      const es = buildDonorPlantDetail(entry, "es").harvestUse!;

      expect(en.options.length).toBeGreaterThan(0);
      expect(es.options.length).toBeGreaterThan(0);
      expect(en.options.flatMap((option) => option.sources).some((source) => source.label.includes(item.enSource))).toBe(true);
      expect(es.options.flatMap((option) => option.sources).some((source) => source.label.includes(item.esSource))).toBe(true);
      expect(en.ediblePart.length).toBeGreaterThan(0);
      expect(es.ediblePart.length).toBeGreaterThan(0);
    }

    expect(buildDonorPlantDetail(findCanonicalEntry("cauliflower-snowball")!, "en").harvestUse?.bestUse).toMatch(/not establish Snowball-specific/i);
    expect(buildDonorPlantDetail(findCanonicalEntry("greek-oregano")!, "en").harvestUse?.bestUse).toMatch(/subsp\. hirtum/i);
    expect(buildDonorPlantDetail(findCanonicalEntry("lacinato-kale")!, "en").harvestUse?.bestUse).toMatch(/does not establish a Lacinato-specific/i);
  });

  it("enriches German thyme with species-scoped cultivation, growth, problem context, and Harvest Use", () => {
    const entry = findCanonicalEntry("german-thyme")!;
    const en = buildDonorPlantDetail(entry, "en");
    const es = buildDonorPlantDetail(entry, "es");
    const enCultivation = en.guides.find((guide) => guide.id === "cultivation");
    const esCultivation = es.guides.find((guide) => guide.id === "cultivation");
    const enProblems = en.guides.find((guide) => guide.id === "problems");
    const esProblems = es.guides.find((guide) => guide.id === "problems");

    expect(en.summary).toMatch(/common name for Thymus vulgaris/i);
    expect(enCultivation?.body).toMatch(/full sun/i);
    expect(esCultivation?.body).toMatch(/sol pleno/i);
    expect(enProblems?.body).toMatch(/no significant insect, disease/i);
    expect(esProblems?.body).toMatch(/no reporta problemas significativos/i);
    expect(en.harvestUse?.bestUse).toMatch(/not as a separate cultivar/i);
    expect(es.harvestUse?.bestUse).toMatch(/no como cultivar separado/i);
    expect(en.harvestUse?.options.every((option) => option.sources.length > 0)).toBe(true);
  });

  it("resolves Harvest Use source links from canonical plant evidence when its display map omits them", () => {
    const detail = buildDonorPlantDetail(findCanonicalEntry("bronze-arrow-lettuce")!, "en");
    const sources = detail.harvestUse?.options.flatMap((option) => option.sources) ?? [];

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining("Cornell Cooperative Extension"),
          url: "https://vegvariety.cce.cornell.edu/main/detail.php?filterBy=0&variety_id=2544",
        }),
      ]),
    );
  });

  it("resolves public Harvest Use sources cited by methods across the catalog", () => {
    const cases = [
      { plantId: "common-chives", sourceLabel: "North Carolina State University Extension" },
      { plantId: "rice-oryza-sativa", sourceLabel: "Tamil Nadu Agricultural University" },
      { plantId: "rice-oryza-sativa", sourceLabel: "Food and Agriculture Organization" },
      { plantId: "sunrise-sauce-tomato", sourceLabel: "University of Minnesota Extension" },
      { plantId: "common-fig", sourceLabel: "Oregon State University Extension" },
      { plantId: "cosmos-sensation", sourceLabel: "University of Illinois Extension" },
    ];

    for (const { plantId, sourceLabel } of cases) {
      for (const language of ["en", "es"] as const) {
        const detail = buildDonorPlantDetail(findCanonicalEntry(plantId)!, language);
        const sources = detail.harvestUse?.options.flatMap((option) => option.sources) ?? [];
        expect(sources.some((source) => source.label.includes(sourceLabel))).toBe(true);
      }
    }
  });

  it("preserves genuinely empty Quick Uses rather than inventing chips", () => {
    for (const plantId of ["cape-jasmine-gardenia-jasminoides", "chinese-hibiscus-hibiscus-rosa-sinensis"]) {
      for (const language of ["en", "es"] as const) {
        const harvestUse = buildDonorPlantDetail(findCanonicalEntry(plantId)!, language).harvestUse;
        expect(harvestUse?.quickUses).toEqual([]);
        expect(harvestUse?.bestUse).toBeTruthy();
      }
    }
  });

  it("renders cultivar-scoped RHS care for Pinguicula 'Weser' without inferring hydroponic fit", () => {
    const entry = findCanonicalEntry("pinguicula-weser")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const englishCultivation = english.guides.find((guide) => guide.id === "cultivation");
    const spanishCultivation = spanish.guides.find((guide) => guide.id === "cultivation");

    expect(englishCultivation?.body).toMatch(/bright, filtered light/i);
    expect(englishCultivation?.sources[0]?.label).toContain("Royal Horticultural Society");
    expect(english.metrics.map((metric) => metric.value)).toContain("Up to 10 cm");
    expect(spanishCultivation?.body).toMatch(/luz brillante filtrada/i);
    expect(spanish.metrics.map((metric) => metric.value)).toContain("Hasta 10 cm");
    expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
    expect(entry.compatibilityProfile?.light.status).toBe("unknown");
    expect(english.guides.find((guide) => guide.id === "propagation")?.body).toMatch(
      /does not claim that seed-grown offspring retain the named cultivar identity/i,
    );
  });

  it("keeps Salanova range evidence distinct from exact cultivar and home-system claims", () => {
    const entry = findCanonicalEntry("green-salanova-lettuce")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const englishHarvest = english.guides.find((guide) => guide.id === "harvest");

    expect(english.summary).toMatch(/not one exact cultivar/i);
    expect(english.guides.find((guide) => guide.id === "cultivation")?.body).toMatch(
      /commercial-production scope/i,
    );
    expect(english.guides.find((guide) => guide.id === "problems")?.body).toMatch(/bolting/i);
    expect(englishHarvest?.body).toMatch(/general lettuce crop evidence/i);
    expect(englishHarvest?.sources.map((source) => source.url)).toContain(
      "https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-lettuce-endive-and-radicchio",
    );
    expect(spanish.guides.find((guide) => guide.id === "harvest")?.body).toMatch(
      /evidencia general del cultivo de lechuga/i,
    );
    expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("compatible");
    expect(entry.compatibilityProfile?.spacing.status).toBe("unknown");
    expect(entry.compatibilityProfile?.matureSize.height.status).toBe("unknown");
  });

  it("adds useful crop-scoped arugula care without turning it into Astro-specific evidence", () => {
    const entry = findCanonicalEntry("astro-arugula")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");
    const harvest = english.guides.find((guide) => guide.id === "harvest");

    expect(english.guides.find((guide) => guide.id === "growth")?.body).toMatch(
      /not measurements or a bolting-resistance claim for Astro/i,
    );
    expect(english.guides.find((guide) => guide.id === "cultivation")?.body).toMatch(
      /not converted to indoor pod counts/i,
    );
    expect(harvest?.body).toMatch(/cut the plant an inch or two above ground/i);
    expect(
      harvest?.sources.some((source) => source.label.includes("University of Wisconsin")),
    ).toBe(true);
    expect(spanish.guides.find((guide) => guide.id === "problems")?.body).toMatch(
      /escarabajos pulga/i,
    );
    expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("compatible");
    expect(entry.compatibilityProfile?.spacing.status).toBe("unknown");
    expect(entry.compatibilityProfile?.matureSize.height.status).toBe("unknown");
  });

  it("enriches Wasabina with mustard-crop guidance while preserving cultivar and taxonomy limits", () => {
    const entry = findCanonicalEntry("wasabina-mustard-greens")!;
    const english = buildDonorPlantDetail(entry, "en");
    const spanish = buildDonorPlantDetail(entry, "es");

    expect(english.guides.find((guide) => guide.id === "growth")?.body).toMatch(
      /species-level lifecycle context only/i,
    );
    expect(english.guides.find((guide) => guide.id === "cultivation")?.body).toMatch(
      /neither source establishes Wasabina-specific hydroponic suitability/i,
    );
    expect(english.guides.find((guide) => guide.id === "harvest")?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Utah State University") }),
      ]),
    );
    expect(spanish.guides.find((guide) => guide.id === "problems")?.body).toMatch(
      /escarabajos pulga/i,
    );
    expect(entry.compatibilityProfile?.hydroponicSuitability.status).toBe("unknown");
    expect(entry.compatibilityProfile?.spacing.status).toBe("unknown");
  });

  it("uses bilingual public Plant Profiles for new identities without leaking seed protocols", () => {
    const passionFruit = buildDonorPlantDetail(findCanonicalEntry("passion-fruit")!, "en");
    const spanishPassionFruit = buildDonorPlantDetail(findCanonicalEntry("passion-fruit")!, "es");
    const papaya = buildDonorPlantDetail(findCanonicalEntry("papaya")!, "en");

    expect(passionFruit.summary).toContain("vine");
    expect(spanishPassionFruit.summary).not.toBe(passionFruit.summary);
    expect(passionFruit.guides.length).toBeGreaterThan(0);
    expect(passionFruit.guides.every((guide) => guide.sources.length > 0)).toBe(true);
    expect(passionFruit.timeline).toBeUndefined();
    expect(passionFruit.metrics.some((metric) => /germination|sowing/i.test(metric.label))).toBe(
      false,
    );
    expect(papaya.guides.some((guide) => guide.backing === "pending")).toBe(true);
  });

  it("does not expose private inventory or instance fields in public view models", () => {
    for (const plant of donorPlants) expect(plant.inventory).toBe("none");
    const publicModel = JSON.stringify(donorPlants);
    for (const privateMarker of [/URUQ\s+12\s+#1/i, /Garden\s+[12]/i, /nickname/i]) {
      expect(publicModel).not.toMatch(privateMarker);
    }
  });

  it("keeps Advisor local and constrained to canonical identities", async () => {
    const response = await getPlantRecommendations({ query: "hierba fácil para cocina" });
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations.every((item) => donorPlantsById.has(item.plantId))).toBe(true);
    expect(response.recommendations.every((item) => item.score >= 0 && item.score <= 100)).toBe(
      true,
    );

    const lowLight = await getPlantRecommendations({ query: "poca luz para interior" });
    expect(lowLight.recommendations).toHaveLength(0);
    expect(lowLight.summary).toContain("intensidad de luz interior");
    const lowLightEnglish = await getPlantRecommendations({
      query: "low light indoors",
      language: "en",
    });
    expect(lowLightEnglish.recommendations).toHaveLength(0);
    expect(lowLightEnglish.summary).toContain("indoor light-intensity");

    const herbsEnglish = await getPlantRecommendations({
      query: "herbs for cooking",
      language: "en",
    });
    expect(herbsEnglish.recommendations.length).toBeGreaterThan(0);
    expect(herbsEnglish.summary).toContain("public catalog identities");

    const hydro = await getPlantRecommendations({ query: "hidroponía compacta" });
    expect(
      hydro.recommendations.every((item) => {
        const suitability = donorPlantsById.get(item.plantId)?.hydroponicSuitability;
        return suitability === "compatible" || suitability === "conditional";
      }),
    ).toBe(true);
  });

  it("shows Santo Cilantro's distinct leaf-freezing and coriander-seed uses bilingually", () => {
    const entry = findCanonicalEntry("santo-cilantro")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.ediblePart).toMatch(/leaves and tender stems.*mature seeds are coriander/i);
    expect(spanish.ediblePart).toMatch(/Hojas y tallos tiernos.*semillas maduras son coriandro/i);
    expect(english.options).toHaveLength(3);
    expect(english.options[0]?.title).toMatch(/fresh leaves/i);
    expect(english.options[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Create Better Health") }),
      ]),
    );
    expect(english.options[1]?.title).toMatch(/freeze leaves/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/cooked dishes/i);
    expect(english.options[1]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining("National Center for Home Food Preservation"),
        }),
      ]),
    );
    expect(english.options[2]?.steps.join(" ")).toMatch(/paper bag/i);
    expect(spanish.bestUse).toMatch(/objetivos de cosecha distintos/i);
    expect(spanish.options[0]?.title).toMatch(/frescas las hojas/i);
    expect(spanish.options[1]?.title).toMatch(/Congelar las hojas/i);
    expect(spanish.options[2]?.steps.join(" ")).toMatch(/bolsa de papel/i);
    expect(english.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
  });

  it("presents UMN's edamame harvest and food-safety steps in EN and ES", () => {
    const entry = findCanonicalEntry("edamame")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(1);
    expect(english.options[0]?.steps.join(" ")).toMatch(/still-green pods.*boil the beans/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/do not eat raw soybeans/i);
    expect(spanish.options[0]?.title).toMatch(/cocinarlas en la vaina/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/no comas soja cruda/i);
    expect(english.options[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("University of Minnesota Extension") }),
      ]),
    );
    expect(english.safetyNote).toMatch(/not to eat raw soybeans/i);
    expect(spanish.safetyNote).toMatch(/no se debe comer soja cruda/i);
  });

  it("provides OSU-backed White Lisbon repeat-harvest and storage guidance in EN/ES", () => {
    const entry = findCanonicalEntry("white-lisbon-bunching-onion")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(2);
    expect(english.options[0]?.lead).toMatch(/White Lisbon among bunching-onion types/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/regrow several times/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/within four months/i);
    expect(spanish.options[0]?.title).toMatch(/cosechas repetidas/i);
    expect(spanish.options[1]?.steps.join(" ")).toMatch(/cuatro meses/i);
    expect(
      english.options.every((option) =>
        option.sources.some((source) => /Oregon State University/.test(source.label)),
      ),
    ).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
  });

  it("adds source-scoped post-harvest storage for both named leek varieties", () => {
    for (const [id, variety] of [
      ["king-richard-leek", "King Richard"],
      ["giant-musselburgh-leek", "Giant Musselburgh"],
    ] as const) {
      const entry = findCanonicalEntry(id)!;
      const english = buildDonorPlantDetail(entry, "en").harvestUse!;
      const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

      expect(english.options).toHaveLength(1);
      expect(english.options[0]?.title).toContain(variety);
      expect(english.options[0]?.lead).toMatch(/UW–Madison says leeks/i);
      expect(english.options[0]?.steps.join(" ")).toMatch(/refrigerat/i);
      expect(spanish.options[0]?.steps.join(" ")).toMatch(/Refrigera los puerros/i);
      expect(english.options[0]?.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: expect.stringContaining("University of Wisconsin") }),
        ]),
      );
      expect(spanish.options[0]?.sources.length).toBeGreaterThan(0);
    }
  });

  it("presents species-scoped Upland Cress harvest and winter uses in EN and ES", () => {
    const entry = findCanonicalEntry("upland-cress")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.ediblePart).toBe("Leaves.");
    expect(english.options).toHaveLength(3);
    expect(english.options[0]?.steps.join(" ")).toMatch(/about 4 inches tall.*stem and roots intact/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/does not quantify the number or interval/i);
    expect(english.options[1]?.title).toMatch(/whole plant at once/i);
    expect(english.options[2]?.lead).toMatch(/cold-hardiest winter greens/i);
    expect(english.options[2]?.steps.join(" ")).toMatch(/west of the Cascades/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/4 pulgadas.*tallo y las raíces/i);
    expect(spanish.options[1]?.title).toMatch(/toda la planta de una vez/i);
    expect(spanish.options[2]?.steps.join(" ")).toMatch(/al oeste de las Cascades/i);
    expect(english.options[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("University of Florida IFAS Extension") }),
      ]),
    );
    expect(english.options[2]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Oregon State University Extension Service") }),
      ]),
    );
    expect(english.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(english.safetyNote).toMatch(/does not infer.*universal storage life/i);
    expect(spanish.safetyNote).toMatch(/no infieras.*duración universal de almacenamiento/i);
  });

  it("keeps Broccolini repeated-shoot harvest scoped to Broccolini evidence in EN and ES", () => {
    const entry = findCanonicalEntry("broccolini")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(1);
    expect(english.options[0]?.title).toMatch(/tender shoots as they become ready/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/rather than waiting for one large central broccoli head/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/no Broccolini-specific cooking, storage, or preservation protocol/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/no una sola cabeza central grande/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/no establecen un protocolo específico/i);
    expect(english.options[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Illinois Extension") }),
        expect.objectContaining({ label: expect.stringContaining("University of Minnesota Extension") }),
        expect.objectContaining({ label: expect.stringContaining("North Carolina State") }),
      ]),
    );
    expect(english.options[0]?.sources.length).toBeGreaterThanOrEqual(3);
    expect(spanish.options[0]?.sources.length).toBeGreaterThanOrEqual(3);
  });

  it("enriches Curled Chervil fresh use and tray drying without claiming a cultivar flavor", () => {
    const entry = findCanonicalEntry("curled-chervil")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(2);
    expect(english.bestUse).toMatch(/not a flavor guarantee for every curled-leaf seed line/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/few soft young leaves.*another flush/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/just before serving/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/just before the blossoms open.*drying tray/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/do not specify how long dried chervil retains quality/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/otro brote/i);
    expect(spanish.options[1]?.title).toMatch(/Secar las hojas en bandeja/i);
    expect(english.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(english.options[1]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Iowa State University Extension") }),
      ]),
    );
  });

  it("provides the same evidence at species scope for the general Chervil identity", () => {
    const entry = findCanonicalEntry("chervil-anthriscus-cerefolium")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(2);
    expect(english.bestUse).toMatch(/species-level culinary guidance for Anthriscus cerefolium/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/few soft young leaves.*5–7.5 cm/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/Iowa State specifically lists chervil leaves for tray drying/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/otro brote/i);
    expect(spanish.options[1]?.title).toMatch(/Secar las hojas en bandeja/i);
    expect(english.options.every((option) => option.sources.length > 0)).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
  });

  it("gives rhubarb age-, safety-, and region-scoped harvest/use guidance in EN and ES", () => {
    const entry = findCanonicalEntry("rhubarb")!;
    const english = buildDonorPlantDetail(entry, "en").harvestUse!;
    const spanish = buildDonorPlantDetail(entry, "es").harvestUse!;

    expect(english.options).toHaveLength(2);
    expect(english.options[0]?.steps.join(" ")).toMatch(/second season.*third season when plants were started from seed/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/pull and twist rather than cutting/i);
    expect(english.options[0]?.steps.join(" ")).toMatch(/discard the leaves because they are toxic/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/Minnesota guide ends routine harvesting around the end of June/i);
    expect(english.options[1]?.steps.join(" ")).toMatch(/myth.*stalks become toxic later in summer/i);
    expect(spanish.options[0]?.steps.join(" ")).toMatch(/tercera si la planta se inició desde semilla/i);
    expect(spanish.options[1]?.summary).toMatch(/corresponde a Minnesota/i);
    expect(spanish.options[1]?.steps.join(" ")).toMatch(/es un mito que los pecíolos se vuelvan tóxicos/i);
    expect(english.options.every((option) =>
      option.sources.some((source) => /University of Minnesota Extension/.test(source.label)),
    )).toBe(true);
    expect(spanish.options.every((option) => option.sources.length > 0)).toBe(true);
  });

  it("distinguishes Sweet Spanish from Walla Walla onion harvest and storage evidence", () => {
    const sweetSpanish = buildDonorPlantDetail(findCanonicalEntry("sweet-spanish-onion")!, "en").harvestUse!;
    const sweetSpanishEs = buildDonorPlantDetail(findCanonicalEntry("sweet-spanish-onion")!, "es").harvestUse!;
    const wallaWalla = buildDonorPlantDetail(findCanonicalEntry("walla-walla-onion")!, "en").harvestUse!;
    const wallaWallaEs = buildDonorPlantDetail(findCanonicalEntry("walla-walla-onion")!, "es").harvestUse!;

    expect(sweetSpanish.options).toHaveLength(2);
    expect(sweetSpanish.options[0]?.steps.join(" ")).toMatch(/tops fall over naturally.*2–3 weeks/i);
    expect(sweetSpanish.options[0]?.steps.join(" ")).toMatch(/specifically names White Sweet Spanish/i);
    expect(sweetSpanish.options[1]?.lead).toMatch(/Sweet Spanish onions as mild/i);
    expect(sweetSpanishEs.options[1]?.steps.join(" ")).toMatch(/complementos crudos/i);

    expect(wallaWalla.options).toHaveLength(2);
    expect(wallaWalla.options[0]?.lead).toMatch(/specifically lists Walla Walla as a poor keeper/i);
    expect(wallaWalla.options[0]?.steps.join(" ")).toMatch(/trim tops about 1 inch above the bulb/i);
    expect(wallaWalla.options[1]?.lead).toMatch(/describes Walla Walla as sweet, mild, and juicy/i);
    expect(wallaWallaEs.options[0]?.title).toMatch(/curar y usar pronto/i);
    expect(wallaWallaEs.options[0]?.steps.join(" ")).toMatch(/poca conservación/i);
    for (const option of [...sweetSpanish.options, ...wallaWalla.options]) {
      expect(option.sources.length).toBeGreaterThan(0);
    }
    for (const option of [...sweetSpanishEs.options, ...wallaWallaEs.options]) {
      expect(option.sources.length).toBeGreaterThan(0);
    }
  });

  it("keeps the donor calculator pure and uses canonical plant ids", () => {
    const result = calculateSingleCropDose({
      plantId: "genovese-basil",
      formulaId: "ab",
      phase: "vegetative",
      liters: 2.5,
    });
    expect(result.crops[0]?.id).toBe("genovese-basil");
    expect(result.parts.every((part) => part.ml >= 0)).toBe(true);
  });
});
