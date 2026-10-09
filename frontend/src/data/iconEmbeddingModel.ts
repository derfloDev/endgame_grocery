/** Model that embeds both the icon database (offline) and the user's text (in the worker). */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
/** Quantisation of that model. The browser's WASM backend uses q8, and so does the offline generator. */
export const EMBEDDING_DTYPE = "q8";
export const EMBEDDING_DIMENSIONS = 384;
