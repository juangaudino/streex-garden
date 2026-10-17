import { describe, expect, it } from "vitest";

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
      expect(english.guides.length).toBeGreaterThan(0);
      expect(spanish.guides.length).toBeGreaterThan(0);
    }
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
    expect(fullSun.length).toBe(226);
    expect(partialSun.length).toBe(10);
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
