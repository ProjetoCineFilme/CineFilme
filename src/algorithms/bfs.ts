import { BiGraph } from '../core/graph';

/**
 * Breadth-First Search (Depth 2) to collect candidate movies.
 * Path: User -> Similar Neighbors -> Their Movies.
 */
export function buscarCandidatos(userId: number, vizinhosIds: number[], grafo: BiGraph): number[] {
  const watchedMovies = new Set(grafo.consultarAdjacencia(userId, 'user').map(e => e.toId));
  const candidates = new Set<number>();

  // For each similar neighbor (user)
  for (const neighborId of vizinhosIds) {
    const neighborMovies = grafo.consultarAdjacencia(neighborId, 'user');
    for (const edge of neighborMovies) {
      if (!watchedMovies.has(edge.toId)) {
        candidates.add(edge.toId);
      }
    }
  }

  return Array.from(candidates);
}
