import { pipeline } from "@xenova/transformers";
import type { IconMatchResult } from "../types";
import { ICON_DB } from "../data/iconDatabase";
import { cosineSimilarity } from "../utils/cosineSimilarity";

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
  readonly __workerBoundary: "xenova-feature-extraction";
};
type FeatureExtractorLoader = () => Promise<WorkerFeatureExtractor>;
type ReferenceEmbedding = {
  embedding: Embedding;
  iconName: string;
};
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
// @ts-expect-error: @xenova/transformers pipeline output is narrowed at the worker boundary and validated before use.
const loadFeatureExtractor: FeatureExtractorLoader = () => {
  return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    quantized: true
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

async function getReferenceEmbeddings(): Promise<ReferenceEmbedding[]> {
  referenceEmbeddingsPromise ??= Promise.all(
    ICON_DB.map(async (entry) => ({
      embedding: await embedText([entry.label, ...(entry.tags ?? [])].join(", ")),
      iconName: entry.icon
    }))
  );

  return referenceEmbeddingsPromise;
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
      await getReferenceEmbeddings();
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
