import { EMBEDDING_DIMENSIONS } from "../data/iconEmbeddingModel";

export interface ReferenceEmbedding {
  embedding: Float32Array;
  iconName: string;
}

/**
 * Splits the shipped embedding asset into one vector per icon database entry.
 *
 * Fails loudly on a size mismatch: an asset that does not belong to the current database would
 * otherwise pair icons with the wrong vectors and silently suggest nonsense.
 */
export function parseReferenceEmbeddings(
  buffer: ArrayBuffer,
  database: ReadonlyArray<{ icon: string }>
): ReferenceEmbedding[] {
  const expectedBytes = database.length * EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT;

  if (buffer.byteLength !== expectedBytes) {
    throw new RangeError(
      `Icon embeddings do not match the icon database (${buffer.byteLength} bytes, expected ${expectedBytes}). ` +
        "Run: npm run build:icon-embeddings --workspace frontend"
    );
  }

  const floats = new Float32Array(buffer);

  return database.map((entry, row) => ({
    embedding: floats.subarray(row * EMBEDDING_DIMENSIONS, (row + 1) * EMBEDDING_DIMENSIONS),
    iconName: entry.icon
  }));
}
