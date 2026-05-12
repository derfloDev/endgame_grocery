export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (typeof vecA?.length !== "number" || typeof vecB?.length !== "number") {
    throw new TypeError("cosineSimilarity expects array-like inputs.");
  }

  if (vecA.length !== vecB.length) {
    throw new RangeError("cosineSimilarity expects vectors of equal length.");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < vecA.length; index += 1) {
    const valueA = Number(vecA[index]);
    const valueB = Number(vecB[index]);

    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}
