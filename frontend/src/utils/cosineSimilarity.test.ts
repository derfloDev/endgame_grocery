import { describe, expect, it } from "vitest";
import { ICON_DB, EXACT_MATCH_MAP } from "../data/iconDatabase";
import { ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import { cosineSimilarity } from "./cosineSimilarity";

describe("icon registry and database", () => {
  it("defines an expanded curated icon registry and exports matching keys", () => {
    expect(ICON_REGISTRY_KEYS.length).toBeGreaterThanOrEqual(125);
    expect(ICON_REGISTRY_KEYS).toEqual(Object.keys(ICON_REGISTRY));
  });

  it("defines an expanded bilingual grocery and household icon database", () => {
    expect(ICON_DB.length).toBeGreaterThanOrEqual(110);
  });

  it("only uses icon names that exist in the registry", () => {
    for (const entry of ICON_DB) {
      expect(ICON_REGISTRY[entry.icon]).toBeTruthy();
    }
  });

  it("keeps every database entry enriched with at least five searchable terms", () => {
    for (const entry of ICON_DB) {
      const terms = new Set([entry.label, ...(entry.tags ?? [])].filter(Boolean));

      expect(terms.size, `${entry.label} should have at least five terms`).toBeGreaterThanOrEqual(5);
    }
  });

  it("resolves known English and German exact matches to registry icon names", () => {
    expect(EXACT_MATCH_MAP.milk).toBe("IconMilk");
    expect(EXACT_MATCH_MAP.milch).toBe("IconMilk");
    expect(EXACT_MATCH_MAP.banana).toBe("Banana");
    expect(EXACT_MATCH_MAP.banane).toBe("Banana");
    expect(EXACT_MATCH_MAP.cheese).toBe("IconCheese");
    expect(EXACT_MATCH_MAP["käse"]).toBe("IconCheese");
    expect(EXACT_MATCH_MAP.water).toBe("IconDroplet");
    expect(EXACT_MATCH_MAP.wasser).toBe("IconDroplet");
    expect(EXACT_MATCH_MAP["toilet paper"]).toBe("IconToiletPaper");
    expect(EXACT_MATCH_MAP.toilettenpapier).toBe("IconToiletPaper");
    expect(EXACT_MATCH_MAP.shampoo).toBe("CustomShampoo");
    expect(EXACT_MATCH_MAP.zahnpasta).toBe("CustomToothpaste");
    expect(EXACT_MATCH_MAP["olive oil"]).toBe("IconBottle");
    expect(EXACT_MATCH_MAP["olivenöl"]).toBe("IconBottle");
    expect(EXACT_MATCH_MAP.chocolate).toBe("CustomChocolate");
    expect(EXACT_MATCH_MAP.schokolade).toBe("CustomChocolate");
    expect(EXACT_MATCH_MAP.croissant).toBe("Croissant");
    expect(EXACT_MATCH_MAP.schinken).toBe("Ham");
    expect(EXACT_MATCH_MAP.shrimp).toBe("Shrimp");
    expect(EXACT_MATCH_MAP.garnele).toBe("Shrimp");
    expect(EXACT_MATCH_MAP.popcorn).toBe("Popcorn");
    expect(EXACT_MATCH_MAP.tee).toBe("IconTeapot");
    expect(EXACT_MATCH_MAP.wine).toBe("Wine");
    expect(EXACT_MATCH_MAP.wein).toBe("Wine");
    expect(EXACT_MATCH_MAP.nuts).toBe("IconNut");
    expect(EXACT_MATCH_MAP.seed).toBe("IconSeedling");
  });

  it("routes redirected and custom icon exact matches to the dedicated registry keys", () => {
    expect(EXACT_MATCH_MAP.garlic).toBe("CustomGarlic");
    expect(EXACT_MATCH_MAP.knoblauch).toBe("CustomGarlic");
    expect(EXACT_MATCH_MAP.pasta).toBe("CustomPasta");
    expect(EXACT_MATCH_MAP.nudeln).toBe("CustomPasta");
    expect(EXACT_MATCH_MAP.grapes).toBe("IconGrape");
    expect(EXACT_MATCH_MAP.trauben).toBe("IconGrape");
    expect(EXACT_MATCH_MAP.zahnseide).toBe("CustomDentalFloss");
    expect(EXACT_MATCH_MAP.zahncreme).toBe("CustomToothpaste");
    expect(EXACT_MATCH_MAP.wattepads).toBe("CustomCottonPads");
    expect(EXACT_MATCH_MAP.hummus).toBe("CustomHummus");
    expect(EXACT_MATCH_MAP.kornflakes).toBe("CustomKornflakesBowl");
    expect(EXACT_MATCH_MAP.bohnen).toBe("IconBean");
    expect(EXACT_MATCH_MAP.rindersteak).toBe("IconBeef");
    expect(EXACT_MATCH_MAP.cannabis).toBe("IconCannabis");
    expect(EXACT_MATCH_MAP.papiertüte).toBe("IconPaperBag");
    expect(EXACT_MATCH_MAP.protein).toBe("BicepsFlexed");
  });

  it("includes all expanded T-006 icon entries in the exact match map", () => {
    const expectedMatches = {
      socken: "IconSock",
      hose: "CustomPants",
      schuhe: "IconShoe",
      ananas: "CustomPineapple",
      wassermelone: "CustomWatermelon",
      feuerzeug: "IconFlame",
      konservendose: "CustomCan",
      "wattestäbchen": "CustomCottonSwabs",
      "feuchtes klopapier": "CustomWetWipes",
      interdentalbürste: "CustomInterdentalSticks",
      "creme tube": "CustomCreamTube",
      cremetiegel: "CustomCreamJar",
      mango: "CustomMango",
      kiwi: "CustomKiwi",
      pfirsich: "CustomPeach",
      pflaume: "CustomPlum",
      blaubeeren: "CustomBlueberries",
      "e-liquid": "CustomELiquid",
      "t-shirt": "IconShirt",
      knopfzelle: "IconBattery"
    };

    for (const [term, iconName] of Object.entries(expectedMatches)) {
      expect(EXACT_MATCH_MAP[term]).toBe(iconName);
    }
  });

  it("routes food and produce exact matches to dedicated icons", () => {
    const expectedMatches = {
      tomato: "CustomTomato",
      paradeiser: "CustomTomato",
      cucumber: "CustomCucumber",
      gurke: "CustomCucumber",
      "bell pepper": "CustomBellPepper",
      paprika: "CustomBellPepper",
      onion: "CustomOnion",
      zwiebel: "CustomOnion",
      potato: "CustomPotato",
      kartoffel: "CustomPotato",
      "bread roll": "CustomBreadRoll",
      broetchen: "CustomBreadRoll",
      baguette: "IconBaguette",
      reis: "CustomRice",
      jam: "CustomJam",
      marmelade: "CustomJam",
      "pasta sauce": "CustomPastaSauce",
      pastasauce: "CustomPastaSauce",
      chips: "CustomChips",
      kartoffelchips: "CustomChips",
      fries: "CustomFries",
      pommes: "CustomFries",
      chocolate: "CustomChocolate",
      schokolade: "CustomChocolate",
      "frozen vegetables": "CustomFrozenVegetables",
      "tiefkühlgemüse": "CustomFrozenVegetables",
      "frozen berries": "CustomFrozenBerries",
      "tiefkühlbeeren": "CustomFrozenBerries",
      butter: "CustomButter",
      cream: "CustomCream",
      sahne: "CustomCream",
      yogurt: "CustomYogurt",
      joghurt: "CustomYogurt",
      quark: "CustomQuark",
      speisequark: "CustomQuark"
    };

    for (const [term, iconName] of Object.entries(expectedMatches)) {
      expect(EXACT_MATCH_MAP[term]).toBe(iconName);
    }
  });

  it("routes drugstore and household exact matches to dedicated icons", () => {
    const expectedMatches = {
      shampoo: "CustomShampoo",
      haarshampoo: "CustomShampoo",
      conditioner: "CustomConditioner",
      spülung: "CustomConditioner",
      "body wash": "CustomBodyWash",
      duschgel: "CustomBodyWash",
      toothbrush: "CustomToothbrush",
      zahnbürste: "CustomToothbrush",
      mouthwash: "CustomMouthwash",
      mundspülung: "CustomMouthwash",
      "shaving cream": "CustomShavingCream",
      rasiercreme: "CustomShavingCream",
      sunscreen: "CustomSunscreen",
      sonnencreme: "CustomSunscreen",
      "after sun": "CustomAfterSun",
      aftersun: "CustomAfterSun",
      diapers: "CustomDiapers",
      windeln: "CustomDiapers",
      "glasses cleaner": "CustomGlassesCleaner",
      brillenreiniger: "CustomGlassesCleaner",
      "cleaning cloth": "CustomCleaningCloth",
      putztuch: "CustomCleaningCloth",
      "storage bags": "CustomStorageBags",
      frischhaltebeutel: "CustomStorageBags",
      "baking paper": "CustomBakingPaper",
      backpapier: "CustomBakingPaper",
      foil: "CustomFoil",
      alufolie: "CustomFoil",
      mop: "CustomMop",
      wischmopp: "CustomMop",
      sponge: "CustomSponge",
      schwamm: "CustomSponge",
      "hand soap": "CustomHandSoap",
      handseife: "CustomHandSoap",
      "fabric softener": "CustomFabricSoftener",
      weichspüler: "CustomFabricSoftener",
      detergent: "CustomDetergent",
      waschmittel: "CustomDetergent",
      "paper towels": "CustomPaperTowels",
      küchenrolle: "CustomPaperTowels"
    };

    for (const [term, iconName] of Object.entries(expectedMatches)) {
      expect(EXACT_MATCH_MAP[term]).toBe(iconName);
    }
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns the expected value for partial overlap", () => {
    expect(cosineSimilarity([1, 1, 0], [1, 0, 1])).toBeCloseTo(0.5);
  });
});
