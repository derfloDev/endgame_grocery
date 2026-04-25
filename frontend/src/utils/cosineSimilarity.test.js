import { describe, expect, it } from "vitest";
import { ICON_DB, EXACT_MATCH_MAP } from "../data/iconDatabase";
import { ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import { cosineSimilarity } from "./cosineSimilarity";

describe("icon registry and database", () => {
  it("defines at least 80 curated Tabler icons and exports matching keys", () => {
    expect(ICON_REGISTRY_KEYS.length).toBeGreaterThanOrEqual(80);
    expect(ICON_REGISTRY_KEYS).toEqual(Object.keys(ICON_REGISTRY));
  });

  it("defines at least 80 bilingual grocery and household entries", () => {
    expect(ICON_DB.length).toBeGreaterThanOrEqual(80);
  });

  it("only uses icon names that exist in the registry", () => {
    for (const entry of ICON_DB) {
      expect(ICON_REGISTRY[entry.icon]).toBeTruthy();
    }
  });

  it("resolves known English and German exact matches to Tabler icon names", () => {
    expect(EXACT_MATCH_MAP.milk).toBe("IconMilk");
    expect(EXACT_MATCH_MAP.milch).toBe("IconMilk");
    expect(EXACT_MATCH_MAP.cheese).toBe("IconCheese");
    expect(EXACT_MATCH_MAP["käse"]).toBe("IconCheese");
    expect(EXACT_MATCH_MAP.water).toBe("IconDroplet");
    expect(EXACT_MATCH_MAP.wasser).toBe("IconDroplet");
    expect(EXACT_MATCH_MAP["toilet paper"]).toBe("IconToiletPaper");
    expect(EXACT_MATCH_MAP.toilettenpapier).toBe("IconToiletPaper");
    expect(EXACT_MATCH_MAP.shampoo).toBe("IconFlask");
    expect(EXACT_MATCH_MAP.zahnpasta).toBe("IconDental");
    expect(EXACT_MATCH_MAP["olive oil"]).toBe("IconBottle");
    expect(EXACT_MATCH_MAP["olivenöl"]).toBe("IconBottle");
    expect(EXACT_MATCH_MAP.chocolate).toBe("IconCandy");
    expect(EXACT_MATCH_MAP.schokolade).toBe("IconCandy");
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
