import { describe, expect, it } from "vitest";
import { ICON_DB, EXACT_MATCH_MAP } from "../data/iconDatabase";
import { cosineSimilarity } from "./cosineSimilarity";

describe("iconDatabase", () => {
  it("defines at least 60 grocery entries", () => {
    expect(ICON_DB.length).toBeGreaterThanOrEqual(60);
  });

  it("resolves known English and German exact matches", () => {
    expect(EXACT_MATCH_MAP.milk).toBe("🥛");
    expect(EXACT_MATCH_MAP.milch).toBe("🥛");
    expect(EXACT_MATCH_MAP.cheese).toBe("🧀");
    expect(EXACT_MATCH_MAP["käse"]).toBe("🧀");
    expect(EXACT_MATCH_MAP.water).toBe("💧");
    expect(EXACT_MATCH_MAP.wasser).toBe("💧");
    expect(EXACT_MATCH_MAP["toilet paper"]).toBe("🧻");
    expect(EXACT_MATCH_MAP.toilettenpapier).toBe("🧻");
    expect(EXACT_MATCH_MAP["olive oil"]).toBe("🫒");
    expect(EXACT_MATCH_MAP["olivenöl"]).toBe("🫒");
    expect(EXACT_MATCH_MAP.chocolate).toBe("🍫");
    expect(EXACT_MATCH_MAP.schokolade).toBe("🍫");
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
