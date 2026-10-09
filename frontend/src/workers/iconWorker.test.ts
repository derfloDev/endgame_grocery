import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ICON_DB } from "../data/iconDatabase";
import { EMBEDDING_DIMENSIONS } from "../data/iconEmbeddingModel";

const asset = readFileSync(path.resolve(import.meta.dirname, "../data/iconEmbeddings.bin"));
const assetBuffer = asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength);

const pipelineMock = vi.hoisted(() => vi.fn());
vi.mock("@huggingface/transformers", () => ({ pipeline: pipelineMock }));

type WorkerMessage = Record<string, unknown>;

async function startWorker() {
  const posted: WorkerMessage[] = [];
  let handler: (event: { data: unknown }) => unknown = () => undefined;

  vi.stubGlobal("self", {
    addEventListener: (_type: string, listener: typeof handler) => { handler = listener; },
    postMessage: (message: WorkerMessage) => { posted.push(message); }
  });
  vi.resetModules();
  await import("./iconWorker");

  async function send(data: WorkerMessage): Promise<WorkerMessage> {
    const before = posted.length;
    await handler({ data });
    return posted[before];
  }

  return { posted, send };
}

/** A query embedding identical to the stored vector of one database entry. */
function rowVector(row: number): number[] {
  return Array.from(new Float32Array(assetBuffer, row * EMBEDDING_DIMENSIONS * 4, EMBEDDING_DIMENSIONS));
}

describe("icon worker", () => {
  const extractor = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extractor.mockReset();
    extractor.mockResolvedValue({ tolist: () => [rowVector(7)] });
    pipelineMock.mockReset();
    pipelineMock.mockResolvedValue(extractor);
    fetchMock = vi.fn().mockImplementation(async () => ({ ok: true, arrayBuffer: async () => assetBuffer.slice(0) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the model quantised as q8 and never embeds the database itself", async () => {
    const { send } = await startWorker();

    await send({ type: "match", id: 1, text: "milk" });

    expect(pipelineMock).toHaveBeenCalledWith("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  });

  it("runs exactly one inference for the first semantic suggestion", async () => {
    const { send } = await startWorker();

    const result = await send({ type: "match", id: 1, text: "milk" });

    expect(extractor).toHaveBeenCalledTimes(1);
    expect(extractor).toHaveBeenCalledWith("milk", { normalize: true, pooling: "mean" });
    expect(result).toMatchObject({ type: "matchResult", id: 1, iconName: ICON_DB[7].icon });
    expect(result.score as number).toBeGreaterThan(0.99);
  });

  it("fetches the shipped vectors once and embeds only the query text afterwards", async () => {
    const { send } = await startWorker();

    await send({ type: "match", id: 1, text: "milk" });
    await send({ type: "match", id: 2, text: "bread" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(extractor).toHaveBeenCalledTimes(2);
  });

  it("prepares the model and the vectors on init without any inference", async () => {
    const { send, posted } = await startWorker();

    await send({ type: "init" });

    expect(posted.at(-1)).toEqual({ type: "ready" });
    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(extractor).not.toHaveBeenCalled();
  });

  it("answers blank text without touching the model", async () => {
    const { send } = await startWorker();

    const result = await send({ type: "match", id: 3, text: "   " });

    expect(result).toMatchObject({ type: "matchResult", id: 3, iconName: null, score: 0, topMatches: [] });
    expect(extractor).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an asset that does not fit the database as an error", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }));
    const { send } = await startWorker();

    const result = await send({ type: "match", id: 4, text: "milk" });

    expect(result).toMatchObject({ type: "matchError", id: 4 });
    expect(String(result.error)).toMatch(/npm run build:icon-embeddings/);
  });

  it("reports a failed asset download as an error", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }));
    const { send } = await startWorker();

    const result = await send({ type: "match", id: 5, text: "milk" });

    expect(result).toMatchObject({ type: "matchError", id: 5 });
  });
});
