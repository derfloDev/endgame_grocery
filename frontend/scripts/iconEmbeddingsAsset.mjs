import { createHash } from "node:crypto";

/**
 * Shared definition of the precomputed icon embedding asset. Used by the generator script and by
 * the staleness test, so both always agree on the format.
 */

import { EMBEDDING_DIMENSIONS, EMBEDDING_DTYPE, EMBEDDING_MODEL } from "../src/data/iconEmbeddingModel.ts";

export { EMBEDDING_DIMENSIONS, EMBEDDING_DTYPE, EMBEDDING_MODEL };
export const REGENERATE_COMMAND = "npm run build:icon-embeddings --workspace frontend";

/** SHA-256 of the embedded texts, in order. Changes whenever a label or tag in `ICON_DB` changes. */
export function hashEmbeddingTexts(texts) {
  return createHash("sha256").update(JSON.stringify(texts), "utf8").digest("hex");
}

/** Packs row vectors into one little-endian Float32 buffer (`count * dimensions * 4` bytes). */
export function packEmbeddings(vectors) {
  const floats = new Float32Array(vectors.length * EMBEDDING_DIMENSIONS);

  vectors.forEach((vector, row) => {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}.`);
    }

    floats.set(vector, row * EMBEDDING_DIMENSIONS);
  });

  return Buffer.from(floats.buffer);
}
