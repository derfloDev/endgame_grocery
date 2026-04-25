import { pipeline } from "@xenova/transformers";
import { ICON_DB } from "../data/iconDatabase";
import { cosineSimilarity } from "../utils/cosineSimilarity";

const configuredThreshold = Number(import.meta.env.VITE_ICON_SIMILARITY_THRESHOLD ?? 0.5);
const similarityThreshold = Number.isFinite(configuredThreshold) ? configuredThreshold : 0.5;

let extractorPromise;
let referenceEmbeddingsPromise;

async function getExtractor() {
  extractorPromise ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    quantized: true
  });

  return extractorPromise;
}

async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    normalize: true,
    pooling: "mean"
  });
  const embedding = output.tolist();

  return Array.isArray(embedding[0]) ? embedding[0] : embedding;
}

async function getReferenceEmbeddings() {
  referenceEmbeddingsPromise ??= Promise.all(
    ICON_DB.map(async (entry) => ({
      embedding: await embedText([entry.label, ...(entry.tags ?? [])].join(", ")),
      icon: entry.icon
    }))
  );

  return referenceEmbeddingsPromise;
}

async function matchIcon(text) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { icon: null, score: 0 };
  }

  const [queryEmbedding, referenceEmbeddings] = await Promise.all([
    embedText(normalizedText),
    getReferenceEmbeddings()
  ]);

  let bestIcon = null;
  let bestScore = -1;

  for (const { embedding, icon } of referenceEmbeddings) {
    const score = cosineSimilarity(queryEmbedding, embedding);

    if (score > bestScore) {
      bestIcon = icon;
      bestScore = score;
    }
  }

  return {
    icon: bestScore >= similarityThreshold ? bestIcon : null,
    score: bestScore
  };
}

self.addEventListener("message", async (event) => {
  const { type, id, text = "" } = event.data ?? {};

  try {
    if (type === "init") {
      await getReferenceEmbeddings();
      self.postMessage({ type: "ready" });
      return;
    }

    if (type === "match") {
      const result = await matchIcon(text);

      self.postMessage({
        type: "matchResult",
        id,
        ...result
      });
    }
  } catch (error) {
    self.postMessage({
      type: "matchError",
      id,
      error: error instanceof Error ? error.message : "Icon worker request failed."
    });
  }
});
