import { describe, expect, it } from "vitest";
import { gardenLibraryManifest } from "@/generated/garden-library-manifest";

import {
  buildSeedLibraryCards,
  filterSeedLibraryCards,
  undocumentedPropagationSummary,
} from "./seed-library-adapter";

describe("lightweight public Seed library adapter", () => {
  it("renders all published cards without loading profile bodies", () => {
    const cards = buildSeedLibraryCards("en");

    expect(cards).toHaveLength(gardenLibraryManifest.entries.length);
    expect(cards.length).toBeGreaterThanOrEqual(500);
    expect(cards.find((card) => card.id === "genovese-basil")).toMatchObject({
      name: "Genovese Basil",
      quickFactCount: expect.any(Number),
      sourceCount: expect.any(Number),
    });
  });

  it("keeps non-seed propagation identities searchable without implying seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    const vegetative = cards.find((card) => card.id === "pinguicula-primuliflora");
    expect(vegetative).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(vegetative?.sources.length).toBeGreaterThan(0);
    expect(cards.find((card) => card.id === "nepenthes-x-ventrata")?.hasSeedProfile).toBe(false);
    for (const id of [
      "sweet-potato-ipomoea-batatas",
      "potato-solanum-tuberosum",
      "garlic-allium-sativum",
      "ginger-zingiber-officinale",
      "turmeric-curcuma-longa",
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        hasSeedProfile: false,
        propagationClass: "vegetative_preferred",
        propagationStatus: "source_backed",
      });
    }
  });

  it("preserves Wave 50 propagation limits and vegetative identities", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "pineapple-ananas-comosus")).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "french-tarragon-artemisia-dracunculus-sativa")).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "catnip-nepeta-cataria")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "wintergreen-gaultheria-procumbens")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "bay-laurel-laurus-nobilis")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "pending",
      hasSeedProfile: false,
      sources: [],
    });
  });

  it("localizes card summaries from generated metadata", () => {
    const english = buildSeedLibraryCards("en").find((card) => card.id === "genovese-basil");
    const spanish = buildSeedLibraryCards("es").find((card) => card.id === "genovese-basil");

    expect(english?.summary).toBeTruthy();
    expect(spanish?.summary).toBeTruthy();
    expect(spanish?.summary).not.toBe(english?.summary);
  });

  it("marks template-based profiles as crop-level baselines in both languages", () => {
    const english = buildSeedLibraryCards("en").find((card) => card.id === "arugula");
    const spanish = buildSeedLibraryCards("es").find((card) => card.id === "arugula");

    expect(english?.contentLevel).toBe("crop_level_baseline");
    expect(english?.summary).toMatch(/crop-level baseline/i);
    expect(spanish?.contentLevel).toBe("crop_level_baseline");
    expect(spanish?.summary).toMatch(/guía base a nivel de cultivo/i);
  });

  it("keeps crop-level seed facts useful without implying cultivar-specific evidence", () => {
    const english = buildSeedLibraryCards("en").find((card) => card.id === "acorn-squash");
    const spanish = buildSeedLibraryCards("es").find((card) => card.id === "acorn-squash");

    expect(english?.contentLevel).toBe("editorial_profile");
    expect(english?.summary).toMatch(/winter-squash guidance/i);
    expect(spanish?.summary).toMatch(/calabazas de invierno/i);
  });

  it("classifies houseplant propagation without inventing seed protocols", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "snake-plant-dracaena-trifasciata")).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "spathiphyllum-wallisii")).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "rubber-plant-ficus-elastica")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(cards.find((card) => card.id === "boston-fern-nephrolepis-exaltata")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    for (const id of [
      "snake-plant-dracaena-trifasciata",
      "spathiphyllum-wallisii",
      "rubber-plant-ficus-elastica",
      "boston-fern-nephrolepis-exaltata",
    ]) {
      expect(cards.find((card) => card.id === id)?.sources.length).toBeGreaterThan(0);
    }
  });

  it("publishes Wave 38 ornamentals in propagation without fake seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    const expected = [
      ["bird-of-paradise-strelitzia-reginae", "insufficient_documentation", "bird of paradise"],
      ["string-of-hearts-ceropegia-woodii", "vegetative_preferred", "cadena de corazones"],
      ["string-of-pearls-curio-rowleyanus", "vegetative_preferred", "string of pearls"],
      ["ripple-peperomia-peperomia-caperata", "vegetative_preferred", "Peperomia caperata"],
      ["panda-plant-kalanchoe-tomentosa", "vegetative_preferred", "Kalanchoe panda"],
    ] as const;

    for (const [id, propagationClass, query] of expected) {
      const card = cards.find((item) => item.id === id);
      expect(card).toMatchObject({
        propagationClass,
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
      expect(card?.sources.length).toBeGreaterThan(0);
      expect(card?.propagationSummary.length).toBeGreaterThan(20);
      expect(filterSeedLibraryCards(cards, { query, mode: "propagation" }).map((item) => item.id)).toContain(id);
    }

    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("publishes Wave 39 identities in propagation without inventing seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    const expected = [
      ["philippine-evergreen-aglaonema-commutatum", "vegetative_preferred", "Philippine evergreen"],
      ["giant-white-bird-of-paradise-strelitzia-nicolai", "insufficient_documentation", "Giant White Bird of Paradise"],
      ["madagascar-dragon-tree-dracaena-reflexa-angustifolia", "vegetative_preferred", "Dracaena marginata"],
      ["gold-dust-dracaena-dracaena-surculosa", "vegetative_preferred", "Gold Dust Dracaena"],
    ] as const;

    for (const [id, propagationClass, query] of expected) {
      const card = cards.find((item) => item.id === id);
      expect(card).toMatchObject({
        propagationClass,
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
      expect(card?.sources.length).toBeGreaterThan(0);
      expect(filterSeedLibraryCards(cards, { query, mode: "propagation" }).map((item) => item.id)).toContain(id);
    }
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("publishes Wave 40 plants in propagation and preserves evidence gaps", () => {
    const cards = buildSeedLibraryCards("en");
    const expected = [
      ["ponytail-palm-beaucarnea-recurvata", "insufficient_documentation", "pending", "Ponytail Palm"],
      ["cape-jasmine-gardenia-jasminoides", "insufficient_documentation", "source_backed", "Cape Jasmine Gardenia"],
      ["chinese-hibiscus-hibiscus-rosa-sinensis", "vegetative_preferred", "source_backed", "Hibiscus rosa-sinensis"],
      ["roselle-sabdariffa-gossypiifolia", "insufficient_documentation", "source_backed", "Hibiscus sabdariffa"],
      ["rose-of-sharon-hibiscus-syriacus", "insufficient_documentation", "pending", "Rose of Sharon"],
    ] as const;

    for (const [id, propagationClass, propagationStatus, query] of expected) {
      const card = cards.find((item) => item.id === id);
      expect(card).toMatchObject({ propagationClass, propagationStatus, hasSeedProfile: false });
      expect(card?.propagationSummary.length).toBeGreaterThan(20);
      expect(filterSeedLibraryCards(cards, { query, mode: "propagation" }).map((item) => item.id)).toContain(id);
    }
    expect(
      filterSeedLibraryCards(cards, { query: "Hibiscus sabdariffa", mode: "propagation" }).map((item) => item.id),
    ).toContain("roselle-sabdariffa-gossypiifolia");
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("publishes Wave 41 identities in propagation without fabricated seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    const expected = [
      ["polka-dot-plant-hypoestes-phyllostachya", "insufficient_documentation", "Polka Dot Plant"],
      ["purple-heart-tradescantia-pallida", "vegetative_preferred", "Purple Heart"],
      ["wax-plant-hoya-pubicalyx", "vegetative_preferred", "Hoya pubicalyx"],
      ["common-staghorn-fern-platycerium-bifurcatum", "insufficient_documentation", "staghorn fern"],
      ["delta-maidenhair-fern-adiantum-raddianum", "vegetative_preferred", "maidenhair fern"],
      ["scarlet-star-guzmania-lingulata", "vegetative_preferred", "Guzmania lingulata"],
      ["thanksgiving-cactus-schlumbergera-truncata", "vegetative_preferred", "Thanksgiving cactus"],
      ["arabian-jasmine-jasminum-sambac", "vegetative_preferred", "Arabian jasmine"],
    ] as const;

    for (const [id, propagationClass, query] of expected) {
      const card = cards.find((item) => item.id === id);
      expect(card).toMatchObject({ propagationClass, propagationStatus: "source_backed", hasSeedProfile: false });
      expect(card?.sources.length).toBeGreaterThan(0);
      expect(card?.propagationSummary.length).toBeGreaterThan(20);
      expect(filterSeedLibraryCards(cards, { query, mode: "propagation" }).map((item) => item.id)).toContain(id);
    }
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("publishes Wave 42 indoor plants in propagation with scoped evidence and honest gaps", () => {
    const cards = buildSeedLibraryCards("en");
    const expected = [
      ["areca-palm-chrysalidocarpus-lutescens", "insufficient_documentation", "Areca Palm"],
      ["norfolk-island-pine-araucaria-heterophylla", "insufficient_documentation", "Norfolk Island Pine"],
      ["nerve-plant-fittonia-albivenis", "vegetative_preferred", "Fittonia albivenis"],
      ["sweetheart-hoya-hoya-kerrii", "vegetative_preferred", "Sweetheart Hoya"],
      ["rattlesnake-plant-goeppertia-insignis", "vegetative_preferred", "Rattlesnake Plant"],
      ["watermelon-peperomia-peperomia-argyraea", "insufficient_documentation", "Watermelon Peperomia"],
      ["lipstick-plant-aeschynanthus-radicans", "vegetative_preferred", "Lipstick Plant"],
      ["mistletoe-cactus-rhipsalis-baccifera", "insufficient_documentation", "Mistletoe Cactus"],
    ] as const;

    for (const [id, propagationClass, query] of expected) {
      const card = cards.find((item) => item.id === id);
      expect(card).toMatchObject({ propagationClass, hasSeedProfile: false });
      expect(card?.propagationSummary.length).toBeGreaterThan(20);
      expect(filterSeedLibraryCards(cards, { query, mode: "propagation" }).map((item) => item.id)).toContain(id);
    }
    expect(cards.find((item) => item.id === "watermelon-peperomia-peperomia-argyraea")).toMatchObject({
      propagationStatus: "pending",
      sources: [],
    });
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
    expect(filterSeedLibraryCards(cards, { mode: "seeds" })).toHaveLength(326);
  });

  it("presents Wave 43 seed and vegetative propagation evidence without conflating the routes", () => {
    const cards = buildSeedLibraryCards("en");
    const waterSpinach = cards.find((card) => card.id === "water-spinach-ipomoea-aquatica");
    expect(waterSpinach).toMatchObject({
      hasSeedProfile: true,
      propagationClass: "seed_supported",
      scientificName: "Ipomoea aquatica",
    });
    expect(waterSpinach?.sourceCount).toBeGreaterThan(0);

    for (const id of [
      "black-currant-ribes-nigrum",
      "red-currant-ribes-rubrum",
      "european-gooseberry-ribes-uva-crispa",
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        hasSeedProfile: false,
        propagationClass: "insufficient_documentation",
        propagationStatus: "source_backed",
      });
    }
    expect(filterSeedLibraryCards(cards, { query: "grosella roja", mode: "propagation" }).map((card) => card.id)).toContain("red-currant-ribes-rubrum");
    expect(filterSeedLibraryCards(cards, { query: "Ipomoea aquatica", mode: "seeds" }).map((card) => card.id)).toContain("water-spinach-ipomoea-aquatica");
    expect(filterSeedLibraryCards(cards, { mode: "seeds" })).toHaveLength(326);
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("keeps species-level Basil and Bunching Onion distinct from named types", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "basil-ocimum-basilicum")).toMatchObject({
      name: "Basil",
      scientificName: "Ocimum basilicum",
      hasSeedProfile: true,
    });
    expect(cards.find((card) => card.id === "genovese-basil")?.name).toBe("Genovese Basil");
    expect(cards.find((card) => card.id === "bunching-onion-allium-fistulosum")).toMatchObject({
      name: "Bunching Onion",
      scientificName: "Allium fistulosum",
      hasSeedProfile: true,
    });
    expect(cards.find((card) => card.id === "evergreen-bunching-onion-nabuka")?.name).toContain("Nabuka");
  });

  it("makes every plant identity addressable in propagation and prioritizes only seed profiles in seed mode", () => {
    const all = buildSeedLibraryCards("en");
    const seedCards = all.filter((card) => card.hasSeedProfile);
    expect(all).toHaveLength(gardenLibraryManifest.entries.length);
    expect(seedCards).toHaveLength(326);
    expect(
      all.find((card) => card.id === "pineapple-mint-mentha-suaveolens-variegata"),
    ).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(all.find((card) => card.id === "pinguicula-weser")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "pending",
      hasSeedProfile: false,
    });
    expect(all.find((card) => card.id === "pinguicula-lilac-lollipop")).toMatchObject({
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    expect(
      all.find((card) => card.id === "greater-galangal-alpinia-galanga"),
    ).toMatchObject({
      propagationClass: "vegetative_preferred",
      hasSeedProfile: false,
    });
    expect(all.find((card) => card.id === "taro-colocasia-esculenta")).toMatchObject({
      propagationClass: "vegetative_preferred",
      hasSeedProfile: false,
    });
    expect(
      all.find((card) => card.id === "black-eyed-pea-vigna-unguiculata-unguiculata")
        ?.hasSeedProfile,
    ).toBe(true);
    expect(
      all.find((card) => card.id === "common-sage-salvia-officinalis")?.hasSeedProfile,
    ).toBe(true);
    expect(
      all.find((card) => card.id === "curry-leaf-tree-bergera-koenigii")?.hasSeedProfile,
    ).toBe(true);
    for (const id of [
      "pothos-epipremnum-aureum",
      "zz-plant-zamioculcas-zamiifolia",
      "spider-plant-chlorophytum-comosum",
      "monstera-adansonii",
    ]) {
      expect(all.find((card) => card.id === id)).toMatchObject({
        propagationClass: "insufficient_documentation",
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
      const card = all.find((item) => item.id === id)!;
      expect(card.sources.length).toBeGreaterThan(0);
      expect(card.propagationSummary).toMatch(/seed|semill/i);
      expect(card.propagationSummary).toMatch(/not|no /i);
    }
  });

  it("explains undocumented propagation as an evidence gap without implying biological impossibility", () => {
    expect(undocumentedPropagationSummary("en")).toMatch(/do not establish a seed protocol/i);
    expect(undocumentedPropagationSummary("en")).toMatch(
      /not a claim that the plant cannot be propagated/i,
    );
    expect(undocumentedPropagationSummary("es")).toMatch(
      /no establecen un protocolo de semilla/i,
    );
    expect(undocumentedPropagationSummary("es")).toMatch(
      /no una afirmación de que la planta no pueda propagarse/i,
    );
  });

  it("filters propagation routes without removing seed profiles from the shared catalog", () => {
    const cards = buildSeedLibraryCards("en");
    const seedSupported = filterSeedLibraryCards(cards, {
      mode: "propagation",
      propagationClass: "seed_supported",
    });
    const vegetative = filterSeedLibraryCards(cards, {
      mode: "propagation",
      propagationClass: "vegetative_preferred",
    });
    const needsReview = filterSeedLibraryCards(cards, {
      mode: "propagation",
      propagationClass: "insufficient_documentation",
    });

    expect(seedSupported).toHaveLength(323);
    expect(vegetative.length).toBeGreaterThan(0);
    expect(needsReview.length).toBeGreaterThan(0);
    expect(seedSupported.every((card) => card.hasSeedProfile)).toBe(true);
    expect(vegetative.every((card) => card.propagationClass === "vegetative_preferred")).toBe(true);
    expect(needsReview.every((card) => card.propagationClass === "insufficient_documentation")).toBe(true);
    expect(needsReview.some((card) => card.propagationStatus === "pending")).toBe(true);
    expect(needsReview.some((card) => card.propagationStatus === "source_backed")).toBe(true);
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
  });

  it("shows fruiting perennials in propagation without inventing seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "northern-highbush-blueberry")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "pending",
      hasSeedProfile: false,
    });
    for (const id of ["red-raspberry", "common-fig", "table-grape-vine"]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        propagationClass: "vegetative_preferred",
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
    }
    expect(filterSeedLibraryCards(cards, { mode: "seeds" })).toHaveLength(326);
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(cards.length);
    expect(cards.find((card) => card.id === "waterleaf-talinum-fruticosum")).toMatchObject({
      hasSeedProfile: true,
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
    });
    for (const id of ["lemon-verbena-aloysia-citrodora", "cuban-oregano-coleus-amboinicus"]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        propagationClass: "vegetative_preferred",
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
    }
  });

  it("keeps Wave 44 berry identities separate and only exposes the evidenced elderberry seed profile", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "american-gooseberry-ribes-hirtellum")).toMatchObject({
      scientificName: "Ribes hirtellum",
      hasSeedProfile: false,
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "black-hawk-black-raspberry")).toMatchObject({
      scientificName: "Rubus occidentalis",
      hasSeedProfile: false,
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "american-elderberry-sambucus-canadensis")).toMatchObject({
      scientificName: "Sambucus canadensis",
      hasSeedProfile: true,
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "american-cranberry-vaccinium-macrocarpon")).toMatchObject({
      scientificName: "Vaccinium macrocarpon",
      hasSeedProfile: false,
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
    });
    expect(filterSeedLibraryCards(cards, { query: "grosella espinosa americana", mode: "propagation" }).map((card) => card.id)).toContain("american-gooseberry-ribes-hirtellum");
    expect(filterSeedLibraryCards(cards, { query: "Vaccinium macrocarpon", mode: "propagation" }).map((card) => card.id)).toContain("american-cranberry-vaccinium-macrocarpon");
  });

  it("lists Wave 46 houseplants in propagation without fabricating seed profiles", () => {
    const cards = buildSeedLibraryCards("en");
    const rosePainted = cards.find((card) => card.id === "rose-painted-calathea-goeppertia-roseopicta");
    const hoyaBella = cards.find((card) => card.id === "beautiful-hoya-hoya-bella");
    const hoyaAustralis = cards.find((card) => card.id === "common-hoya-hoya-australis");
    const schillersOrchid = cards.find((card) => card.id === "schillers-moth-orchid-phalaenopsis-schilleriana");
    const ctenanthe = cards.find((card) => card.id === "giant-bamburanta-ctenanthe-oppenheimiana");

    expect(rosePainted).toMatchObject({ hasSeedProfile: false, propagationClass: "vegetative_preferred", propagationStatus: "source_backed" });
    expect(hoyaBella).toMatchObject({ hasSeedProfile: false, propagationClass: "vegetative_preferred", propagationStatus: "source_backed" });
    expect(hoyaAustralis).toMatchObject({ hasSeedProfile: false, propagationClass: "insufficient_documentation", propagationStatus: "source_backed" });
    expect(schillersOrchid).toMatchObject({ hasSeedProfile: false, propagationClass: "insufficient_documentation", propagationStatus: "pending" });
    expect(ctenanthe).toMatchObject({ hasSeedProfile: false, propagationClass: "vegetative_preferred", propagationStatus: "source_backed" });
    expect(filterSeedLibraryCards(cards, { query: "Calathea roseopicta", mode: "propagation" }).map((card) => card.id)).toContain("rose-painted-calathea-goeppertia-roseopicta");
    expect(filterSeedLibraryCards(cards, { query: "Hoya bella", mode: "propagation" }).map((card) => card.id)).toContain("beautiful-hoya-hoya-bella");
    expect(filterSeedLibraryCards(cards, { query: "Calathea roseopicta", mode: "seeds" })).toHaveLength(0);
  });

  it("lists the distinct Wave 47 species in propagation without duplicating existing houseplants", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "false-african-violet-streptocarpus-saxorum")).toMatchObject({ hasSeedProfile: true, propagationClass: "seed_supported" });
    expect(filterSeedLibraryCards(cards, { query: "false African violet", mode: "seeds" }).map((card) => card.id)).toEqual(["false-african-violet-streptocarpus-saxorum"]);
    expect(filterSeedLibraryCards(cards, { query: "Streptocarpus saxorum", mode: "propagation" }).map((card) => card.id)).toContain("false-african-violet-streptocarpus-saxorum");
  });

  it("keeps Wave 44 berry identities separate and only exposes the evidenced elderberry seed profile", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "american-gooseberry-ribes-hirtellum")).toMatchObject({
      scientificName: "Ribes hirtellum",
      hasSeedProfile: false,
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "black-hawk-black-raspberry")).toMatchObject({
      scientificName: "Rubus occidentalis",
      hasSeedProfile: false,
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "american-elderberry-sambucus-canadensis")).toMatchObject({
      scientificName: "Sambucus canadensis",
      hasSeedProfile: true,
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
    });
    expect(cards.find((card) => card.id === "american-cranberry-vaccinium-macrocarpon")).toMatchObject({
      scientificName: "Vaccinium macrocarpon",
      hasSeedProfile: false,
      propagationClass: "vegetative_preferred",
      propagationStatus: "source_backed",
    });
    expect(filterSeedLibraryCards(cards, { query: "grosella espinosa americana", mode: "propagation" }).map((card) => card.id)).toContain("american-gooseberry-ribes-hirtellum");
    expect(filterSeedLibraryCards(cards, { query: "Vaccinium macrocarpon", mode: "propagation" }).map((card) => card.id)).toContain("american-cranberry-vaccinium-macrocarpon");
  });

  it("publishes Hoja Santa as a species-level seed-and-cutting identity without inventing germination values", () => {
    const cards = buildSeedLibraryCards("en");
    const hojaSanta = cards.find((card) => card.id === "hoja-santa-piper-auritum");
    expect(hojaSanta).toMatchObject({
      name: "Hoja Santa",
      scientificName: "Piper auritum",
      hasSeedProfile: true,
      propagationClass: "seed_supported",
    });
    expect(hojaSanta?.sourceCount).toBeGreaterThan(0);
    expect(
      filterSeedLibraryCards(cards, { query: "hoja santa", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("hoja-santa-piper-auritum");
  });

  it("publishes Wave 32 herbs in EN/ES propagation search without inventing seed profiles", () => {
    const english = buildSeedLibraryCards("en");
    const spanish = buildSeedLibraryCards("es");
    expect(spanish.find((card) => card.id === "lemon-verbena-aloysia-citrodora")?.spanishName).toBe("Hierba luisa");
    expect(spanish.find((card) => card.id === "cuban-oregano-coleus-amboinicus")?.spanishName).toBe("Orégano cubano");
    expect(filterSeedLibraryCards(english, { query: "hierba luisa", mode: "propagation" }).map((card) => card.id)).toContain("lemon-verbena-aloysia-citrodora");
    expect(filterSeedLibraryCards(english, { query: "orégano cubano", mode: "propagation" }).map((card) => card.id)).toContain("cuban-oregano-coleus-amboinicus");
  });

  it("publishes Wave 33 houseplants through propagation with honest route states", () => {
    const cards = buildSeedLibraryCards("en");
    expect(cards.find((card) => card.id === "purple-shamrock-oxalis-triangularis")).toMatchObject({
      propagationClass: "insufficient_documentation",
      propagationStatus: "source_backed",
      hasSeedProfile: false,
    });
    for (const id of [
      "arrowhead-plant-syngonium-podophyllum",
      "baby-rubber-plant-peperomia-obtusifolia",
      "satin-pothos-scindapsus-pictus",
      "chinese-money-plant-pilea-peperomioides",
    ]) {
      const card = cards.find((entry) => entry.id === id);
      expect(card).toMatchObject({
        propagationClass: "vegetative_preferred",
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
      expect(card?.sources.length).toBeGreaterThan(0);
    }
    expect(filterSeedLibraryCards(cards, { query: "singonio", mode: "propagation" }).map((card) => card.id)).toContain("arrowhead-plant-syngonium-podophyllum");
    expect(filterSeedLibraryCards(cards, { query: "poto satinado", mode: "propagation" }).map((card) => card.id)).toContain("satin-pothos-scindapsus-pictus");
    expect(buildSeedLibraryCards("es").find((card) => card.id === "chinese-money-plant-pilea-peperomioides")?.spanishName).toBe("Planta china del dinero");
  });

  it("makes Wave 37 houseplants addressable through propagation without inventing seed profiles", () => {
    const en = buildSeedLibraryCards("en");
    const es = buildSeedLibraryCards("es");
    const expected: Record<string, "vegetative_preferred" | "insufficient_documentation"> = {
      "goeppertia-orbifolia": "vegetative_preferred",
      "croton-codiaeum-variegatum": "vegetative_preferred",
      "florist-kalanchoe-kalanchoe-blossfeldiana": "vegetative_preferred",
      "dwarf-umbrella-tree-heptapleurum-arboricola": "insufficient_documentation",
      "weeping-fig-ficus-benjamina": "vegetative_preferred",
    };
    for (const [id, propagationClass] of Object.entries(expected)) {
      expect(en.find((card) => card.id === id)).toMatchObject({
        hasSeedProfile: false,
        propagationClass,
        propagationStatus: "source_backed",
      });
      expect(en.find((card) => card.id === id)?.sources.length).toBeGreaterThan(0);
      expect(es.find((card) => card.id === id)?.propagationSummary).not.toBe(
        en.find((card) => card.id === id)?.propagationSummary,
      );
    }
    expect(
      filterSeedLibraryCards(en, { query: "Schefflera arboricola", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("dwarf-umbrella-tree-heptapleurum-arboricola");
  });

  it("publishes Wave 34 indoor ornamentals with species-scoped sources and explicit propagation gaps", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, scientificName, propagationStatus] of [
      ["cast-iron-plant-aspidistra-elatior", "Aspidistra elatior", "pending"],
      ["parlor-palm-chamaedorea-elegans", "Chamaedorea elegans", "pending"],
      ["birds-nest-fern-asplenium-nidus", "Asplenium nidus", "source_backed"],
      ["african-violet-streptocarpus-ionanthus", "Streptocarpus ionanthus", "source_backed"],
    ]) {
      const card = cards.find((entry) => entry.id === id);
      expect(card).toMatchObject({
        scientificName,
        propagationClass: "insufficient_documentation",
        propagationStatus,
        hasSeedProfile: false,
      });
    }
    expect(filterSeedLibraryCards(cards, { query: "helecho nido de ave", mode: "propagation" }).map((card) => card.id)).toContain("birds-nest-fern-asplenium-nidus");
    expect(buildSeedLibraryCards("es").find((card) => card.id === "african-violet-streptocarpus-ionanthus")?.spanishName).toBe("Violeta africana");
  });

  it("surfaces newly documented houseplants as public vegetative-propagation entries", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, sourceId] of [
      ["monstera-deliciosa", "ncsu-monstera-deliciosa-500"],
      ["heartleaf-philodendron-philodendron-hederaceum", "ncsu-philodendron-hederaceum-500"],
      ["aloe-vera", "ncsu-aloe-vera-500"],
      ["jade-plant-crassula-ovata", "ncsu-crassula-ovata-500"],
      ["fiddle-leaf-fig-ficus-lyrata", "ncsu-ficus-lyrata-500"],
      ["wax-plant-hoya-carnosa", "ncsu-hoya-carnosa-500"],
      ["inch-plant-tradescantia-zebrina", "ncsu-tradescantia-zebrina-500"],
      ["corn-plant-dracaena-fragrans", "ncsu-dracaena-fragrans-500"],
      ["prayer-plant-maranta-leuconeura", "ncsu-maranta-leuconeura-500"],
    ]) {
      const card = cards.find((entry) => entry.id === id);
      expect(card).toMatchObject({
        propagationClass: "vegetative_preferred",
        propagationStatus: "source_backed",
        hasSeedProfile: false,
      });
      expect(card?.sources.map((source) => source.id)).toContain(sourceId);
    }
  });

  it("keeps newly evidenced seed crops distinct and addressable with propagation-specific facts", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, scientificName] of [
      ["okra-abelmoschus-esculentus", "Abelmoschus esculentus"],
      ["vegetable-amaranth-amaranthus-tricolor", "Amaranthus tricolor"],
      ["garden-cress-lepidium-sativum", "Lepidium sativum"],
      ["corn-salad-valeriana-locusta", "Valeriana locusta"],
      ["common-sorrel-rumex-acetosa", "Rumex acetosa"],
      ["malabar-spinach-basella-alba", "Basella alba"],
      ["yardlong-bean-vigna-unguiculata-sesquipedalis", "Vigna unguiculata subsp. sesquipedalis"],
      ["bitter-melon-momordica-charantia", "Momordica charantia"],
      ["peanut-arachis-hypogaea", "Arachis hypogaea"],
      ["common-purslane-portulaca-oleracea", "Portulaca oleracea"],
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        scientificName,
        propagationClass: "seed_supported",
        hasSeedProfile: true,
      });
    }
    expect(
      filterSeedLibraryCards(cards, { query: "canónigos", mode: "propagation" }).map(
        (card) => card.id,
      ),
    ).toContain("corn-salad-valeriana-locusta");
    expect(
      filterSeedLibraryCards(cards, { query: "acedera común", mode: "seeds" }).map(
        (card) => card.id,
      ),
    ).toContain("common-sorrel-rumex-acetosa");
    expect(
      filterSeedLibraryCards(cards, { query: "verdolaga", mode: "seeds" }).map((card) => card.id),
    ).toContain("common-purslane-portulaca-oleracea");
    expect(
      filterSeedLibraryCards(cards, { query: "frijol espárrago", mode: "seeds" }).map(
        (card) => card.id,
      ),
    ).toContain("yardlong-bean-vigna-unguiculata-sesquipedalis");
  });

  it("adds Wave 25 crops to public propagation search with seed-specific records", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, scientificName] of [
      ["southern-pea-vigna-unguiculata", "Vigna unguiculata"],
      ["mung-bean-vigna-radiata", "Vigna radiata"],
      ["tong-hao-glebionis-coronaria", "Glebionis coronaria"],
      ["honeydew-melon-cucumis-melo", "Cucumis melo"],
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        scientificName,
        propagationClass: "seed_supported",
        hasSeedProfile: true,
      });
    }
    expect(
      filterSeedLibraryCards(cards, { query: "cowpea", mode: "propagation" }).map((card) => card.id),
    ).toContain("southern-pea-vigna-unguiculata");
    expect(
      filterSeedLibraryCards(cards, { query: "mungo", mode: "seeds" }).map((card) => card.id),
    ).toContain("mung-bean-vigna-radiata");
    expect(
      filterSeedLibraryCards(cards, { query: "melón honeydew", mode: "seeds" }).map((card) => card.id),
    ).toContain("honeydew-melon-cucumis-melo");
  });

  it("includes Wave 57 seed-grown crops in both Seed and Propagation discovery", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, scientificName] of [
      ["sesame-sesamum-indicum", "Sesamum indicum"],
      ["purple-pitcher-plant-sarracenia-purpurea", "Sarracenia purpurea"],
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        scientificName,
        propagationClass: "seed_supported",
        hasSeedProfile: true,
      });
      expect(filterSeedLibraryCards(cards, { mode: "seeds", query: scientificName }).map((card) => card.id)).toContain(id);
      expect(filterSeedLibraryCards(cards, { mode: "propagation", query: scientificName }).map((card) => card.id)).toContain(id);
    }
  });

  it("includes Wave 58 flower seeds in both Seed and Propagation discovery", () => {
    const cards = buildSeedLibraryCards("en");
    for (const [id, scientificName] of [
      ["sweet-william-dianthus-barbatus", "Dianthus barbatus"],
      ["hollyhock-alcea-rosea", "Alcea rosea"],
      ["common-foxglove-digitalis-purpurea", "Digitalis purpurea"],
      ["annual-babys-breath-gypsophila-elegans", "Gypsophila elegans"],
    ]) {
      expect(cards.find((card) => card.id === id)).toMatchObject({
        scientificName,
        propagationClass: "seed_supported",
        hasSeedProfile: true,
      });
      expect(
        filterSeedLibraryCards(cards, { mode: "seeds", query: scientificName }).map((card) => card.id),
      ).toContain(id);
      expect(
        filterSeedLibraryCards(cards, { mode: "propagation", query: scientificName }).map((card) => card.id),
      ).toContain(id);
    }
  });
});
