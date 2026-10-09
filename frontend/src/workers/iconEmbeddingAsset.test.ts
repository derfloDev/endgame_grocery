import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS } from "../data/iconEmbeddingModel";
import { parseReferenceEmbeddings } from "./iconEmbeddingAsset";

function createAsset(rows: number): ArrayBuffer {
  const floats = new Float32Array(rows * EMBEDDING_DIMENSIONS);
  floats.forEach((_, index) => { floats[index] = index; });

  return floats.buffer;
}

describe("parseReferenceEmbeddings", () => {
  it("assigns each icon its own row of the asset", () => {
    const rows = parseReferenceEmbeddings(createAsset(2), [{ icon: "IconMilk" }, { icon: "IconBread" }]);

    expect(rows.map((row) => row.iconName)).toEqual(["IconMilk", "IconBread"]);
    expect(rows[0].embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(rows[0].embedding[0]).toBe(0);
    expect(rows[1].embedding[0]).toBe(EMBEDDING_DIMENSIONS);
  });

  it("rejects an asset that does not belong to the database, naming the regeneration command", () => {
    expect(() => parseReferenceEmbeddings(createAsset(1), [{ icon: "A" }, { icon: "B" }])).toThrow(
      /npm run build:icon-embeddings/
    );
  });
});
