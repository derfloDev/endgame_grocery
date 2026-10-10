import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL,
  REGENERATE_COMMAND,
  hashEmbeddingTexts
} from "../../scripts/iconEmbeddingsAsset.mjs";
import { ICON_DB } from "./iconDatabase";
import { getIconEmbeddingText } from "./iconEmbeddingText";

const dataDir = import.meta.dirname;
const meta = JSON.parse(readFileSync(path.join(dataDir, "iconEmbeddings.meta.json"), "utf8")) as {
  count: number;
  dimensions: number;
  dtype: string;
  model: string;
  textsSha256: string;
};
const asset = readFileSync(path.join(dataDir, "iconEmbeddings.bin"));

describe("precomputed icon embeddings", () => {
  it("is in sync with the icon database (regenerate with the npm script when this fails)", () => {
    const texts = ICON_DB.map(getIconEmbeddingText);

    expect(
      { count: meta.count, hash: meta.textsSha256 },
      `Icon database changed but the shipped embeddings are stale. Run: ${REGENERATE_COMMAND}`
    ).toEqual({ count: texts.length, hash: hashEmbeddingTexts(texts) });
  });

  it("was produced by the model and quantisation the worker loads", () => {
    expect(meta.model).toBe(EMBEDDING_MODEL);
    expect(meta.dtype).toBe(EMBEDDING_DTYPE);
    expect(meta.dimensions).toBe(EMBEDDING_DIMENSIONS);
  });

  it("holds one float32 vector per database entry", () => {
    expect(asset.length).toBe(meta.count * meta.dimensions * 4);
  });

  it("holds normalised vectors, like the query embeddings", () => {
    const floats = new Float32Array(asset.buffer, asset.byteOffset, asset.length / 4);

    for (let row = 0; row < meta.count; row += 1) {
      let sum = 0;

      for (let column = 0; column < meta.dimensions; column += 1) {
        sum += floats[row * meta.dimensions + column] ** 2;
      }

      expect(Math.sqrt(sum)).toBeCloseTo(1, 3);
    }
  });

  it("detects a changed label or tag through the hash", () => {
    const texts = ICON_DB.map(getIconEmbeddingText);

    expect(hashEmbeddingTexts([...texts.slice(0, -1), `${texts.at(-1)}, extra tag`])).not.toBe(hashEmbeddingTexts(texts));
  });
});
