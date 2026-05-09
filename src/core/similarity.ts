import { BiGraph } from './graph';

/**
 * Calculates Cosine Similarity between two users in the graph.
 */
export function calcularSimilaridade(userA: number, userB: number, grafo: BiGraph): number {
  const ratingsA = grafo.consultarAdjacencia(userA, 'user');
  const ratingsB = grafo.consultarAdjacencia(userB, 'user');

  if (ratingsA.length === 0 || ratingsB.length === 0) return 0;

  const mapA = new Map(ratingsA.map(e => [e.toId, e.weight]));
  const mapB = new Map(ratingsB.map(e => [e.toId, e.weight]));

  // Intersection of movies
  const commonMovies = Array.from(mapA.keys()).filter(movieId => mapB.has(movieId));
  
  if (commonMovies.length === 0) return 0;

  let dotProduct = 0;
  for (const movieId of commonMovies) {
    dotProduct += mapA.get(movieId)! * mapB.get(movieId)!;
  }

  let normA = 0;
  for (const rating of ratingsA) {
    normA += Math.pow(rating.weight, 2);
  }
  normA = Math.sqrt(normA);

  let normB = 0;
  for (const rating of ratingsB) {
    normB += Math.pow(rating.weight, 2);
  }
  normB = Math.sqrt(normB);

  return dotProduct / (normA * normB);
}
