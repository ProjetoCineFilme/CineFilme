import { BiGraph, NodeId } from './graph';

const normalize = (s: string) =>
  s ? s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : 'geral';

function buildGenreProfile(ratings: { toId: NodeId; weight: number }[], grafo: BiGraph): Map<string, number> {
  const profile = new Map<string, number>();
  for (const edge of ratings) {
    const genres = grafo.getMovieGenres(edge.toId);
    for (const g of genres) {
      const key = normalize(g);
      profile.set(key, (profile.get(key) || 0) + Number(edge.weight));
    }
  }
  return profile;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [k, va] of a) {
    normA += va * va;
    const vb = b.get(k) || 0;
    dot += va * vb;
  }
  for (const vb of b.values()) normB += vb * vb;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function calcularSimilaridade(userA: NodeId, userB: NodeId, grafo: BiGraph): number {
  const ratingsA = grafo.consultarAdjacencia(userA, 'user');
  const ratingsB = grafo.consultarAdjacencia(userB, 'user');

  if (ratingsA.length === 0 || ratingsB.length === 0) return 0;

  // 1. Movie-level cosine similarity
  const mapA = new Map(ratingsA.map(e => [String(e.toId), e.weight]));
  const mapB = new Map(ratingsB.map(e => [String(e.toId), e.weight]));
  const commonMovies = Array.from(mapA.keys()).filter(mid => mapB.has(mid));

  let movieSim = 0;
  if (commonMovies.length > 0) {
    let dot = 0;
    for (const mid of commonMovies) dot += mapA.get(mid)! * mapB.get(mid)!;
    const normA = Math.sqrt(ratingsA.reduce((s, e) => s + e.weight ** 2, 0));
    const normB = Math.sqrt(ratingsB.reduce((s, e) => s + e.weight ** 2, 0));
    movieSim = dot / (normA * normB);
  }

  // 2. Genre-profile cosine similarity (uses ALL genres per movie)
  const profileA = buildGenreProfile(ratingsA, grafo);
  const profileB = buildGenreProfile(ratingsB, grafo);
  const genreSim = cosineSimilarity(profileA, profileB);

  if (commonMovies.length > 0) {
    return movieSim * 0.5 + genreSim * 0.5;
  }

  // No common movies — rely entirely on genre overlap
  return genreSim;
}
