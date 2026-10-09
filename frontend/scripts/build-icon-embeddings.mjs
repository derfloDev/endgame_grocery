// Regenerates src/data/iconEmbeddings.bin and iconEmbeddings.meta.json.
//
//   npm run build:icon-embeddings --workspace frontend
//
// The browser worker used to embed every icon database entry on first use (about 200 model
// inferences). The vectors only depend on the database text and the model, so they are computed
// here once and shipped as an asset; the worker then embeds only the user's query.
// Needs network access once to download the model (cached by transformers.js afterwards).
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";
import { ICON_DB } from "../src/data/iconDatabase.ts";
import { getIconEmbeddingText } from "../src/data/iconEmbeddingText.ts";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL,
  hashEmbeddingTexts,
  packEmbeddings
} from "./iconEmbeddingsAsset.mjs";

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
const texts = ICON_DB.map(getIconEmbeddingText);

const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: EMBEDDING_DTYPE });
const vectors = [];

for (const text of texts) {
  const output = await extractor(text, { normalize: true, pooling: "mean" });
  vectors.push(Array.from(output.data));
}

await writeFile(path.join(dataDir, "iconEmbeddings.bin"), packEmbeddings(vectors));
await writeFile(
  path.join(dataDir, "iconEmbeddings.meta.json"),
  `${JSON.stringify(
    {
      model: EMBEDDING_MODEL,
      dtype: EMBEDDING_DTYPE,
      dimensions: EMBEDDING_DIMENSIONS,
      count: texts.length,
      textsSha256: hashEmbeddingTexts(texts)
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${texts.length} embeddings (${EMBEDDING_DIMENSIONS} dimensions) to ${dataDir}`);
process.exit(0);
