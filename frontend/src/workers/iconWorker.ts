import { pipeline } from "@huggingface/transformers";
import type { IconMatchResult } from "../types";
import { ICON_DB } from "../data/iconDatabase";
import embeddingsUrl from "../data/iconEmbeddings.bin?url";
import { EMBEDDING_DTYPE, EMBEDDING_MODEL } from "../data/iconEmbeddingModel";
import { cosineSimilarity } from "../utils/cosineSimilarity";
import { parseReferenceEmbeddings } from "./iconEmbeddingAsset";
import type { ReferenceEmbedding } from "./iconEmbeddingAsset";

const configuredThreshold = Number(import.meta.env.VITE_ICON_SIMILARITY_THRESHOLD ?? 0.5);
const similarityThreshold = Number.isFinite(configuredThreshold) ? configuredThreshold : 0.5;

type Embedding = number[];
type ExtractorOutput = {
  tolist: () => unknown;
};
type FeatureExtractor = (
  text: string,
  options: { normalize: boolean; pooling: "mean" }
) => Promise<ExtractorOutput>;
type WorkerFeatureExtractor = FeatureExtractor & {
  readonly __workerBoundary: "huggingface-feature-extraction";
};
type FeatureExtractorLoader = () => Promise<WorkerFeatureExtractor>;
type IconWorkerRequest = {
  type?: "init" | "match";
  id?: number;
  text?: string;
};
type IconWorkerGlobalScope = EventTarget & {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
};

let extractorPromise: Promise<FeatureExtractor> | undefined;
let referenceEmbeddingsPromise: Promise<ReferenceEmbedding[]> | undefined;

const workerSelf = self as unknown as IconWorkerGlobalScope;
// @ts-expect-error: transformers pipeline output is narrowed at the worker boundary and validated before use.
const loadFeatureExtractor: FeatureExtractorLoader = () => {
  return pipeline("feature-extraction", EMBEDDING_MODEL, {
    dtype: EMBEDDING_DTYPE
  });
};

async function getExtractor(): Promise<FeatureExtractor> {
  extractorPromise ??= loadFeatureExtractor();

  return extractorPromise;
}

function isEmbedding(value: unknown): value is Embedding {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function toEmbedding(value: unknown): Embedding {
  const candidate = Array.isArray(value) && Array.isArray(value[0]) ? value[0] : value;

  if (!isEmbedding(candidate)) {
    throw new TypeError("Icon worker expected a numeric embedding.");
  }

  return candidate;
}

async function embedText(text: string): Promise<Embedding> {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    normalize: true,
    pooling: "mean"
  });

  return toEmbedding(output.tolist());
}

/**
 * The vectors of the icon database are computed offline (`npm run build:icon-embeddings`) and
 * shipped as an asset, so the first suggestion only has to embed the user's text instead of
 * running about 200 inferences first.
 */
async function getReferenceEmbeddings(): Promise<ReferenceEmbedding[]> {
  referenceEmbeddingsPromise ??= loadReferenceEmbeddings().catch((error: unknown) => {
    // Allow a later request to retry after a failed download.
    referenceEmbeddingsPromise = undefined;
    throw error;
  });

  return referenceEmbeddingsPromise;
}

async function loadReferenceEmbeddings(): Promise<ReferenceEmbedding[]> {
  const response = await fetch(embeddingsUrl);

  if (!response.ok) {
    throw new Error(`Icon embeddings could not be loaded (HTTP ${response.status}).`);
  }

  return parseReferenceEmbeddings(await response.arrayBuffer(), ICON_DB);
}

async function matchIcon(text: string): Promise<IconMatchResult> {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { iconName: null, score: 0, topMatches: [] };
  }

  const [queryEmbedding, referenceEmbeddings] = await Promise.all([
    embedText(normalizedText),
    getReferenceEmbeddings()
  ]);

  let bestIconName: string | null = null;
  let bestScore = -1;
  const matchScores = new Map<string, number>();

  for (const { embedding, iconName } of referenceEmbeddings) {
    const score = cosineSimilarity(queryEmbedding, embedding);
    const previousScore = matchScores.get(iconName) ?? -1;

    if (score > previousScore) {
      matchScores.set(iconName, score);
    }

    if (score > bestScore) {
      bestIconName = iconName;
      bestScore = score;
    }
  }

  const topMatches = [...matchScores.entries()]
    .filter(([, score]) => score >= 0.25)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([iconName, score]) => ({ iconName, score }));

  return {
    iconName: bestScore >= similarityThreshold ? bestIconName : null,
    score: bestScore,
    topMatches: bestScore >= similarityThreshold ? topMatches : []
  };
}

workerSelf.addEventListener("message", async (event) => {
  const { type, id, text = "" } = (event.data ?? {}) as IconWorkerRequest;

  try {
    if (type === "init") {
      await Promise.all([getExtractor(), getReferenceEmbeddings()]);
      workerSelf.postMessage({ type: "ready" });
      return;
    }

    if (type === "match") {
      const result = await matchIcon(text);

      workerSelf.postMessage({
        type: "matchResult",
        id,
        ...result
      });
    }
  } catch (error) {
    workerSelf.postMessage({
      type: "matchError",
      id,
      error: error instanceof Error ? error.message : "Icon worker request failed."
    });
  }
});
