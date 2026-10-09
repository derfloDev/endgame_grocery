/** The part of an icon database entry that is embedded. */
interface EmbeddableIconEntry {
  label: string;
  tags?: readonly string[];
}

/**
 * The text that represents an icon database entry in the embedding space: its label followed by
 * its tags. The offline generator (`scripts/build-icon-embeddings.mjs`) and the worker must agree
 * on this exactly; the staleness test fails when the database and the shipped vectors diverge.
 */
export function getIconEmbeddingText(entry: EmbeddableIconEntry): string {
  return [entry.label, ...(entry.tags ?? [])].join(", ");
}
