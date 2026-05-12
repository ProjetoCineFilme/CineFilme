import { BiGraph, NodeId } from './graph';

/**
 * Calculates Cosine Similarity between two users in the graph.
 * Now considers both shared movies AND shared genre preferences.
 */
export function calcularSimilaridade(userA: NodeId, userB: NodeId, grafo: BiGraph): number {
  const ratingsA = grafo.consultarAdjacencia(userA, 'user');
  const ratingsB = grafo.consultarAdjacencia(userB, 'user');

  if (ratingsA.length === 0 || ratingsB.length === 0) return 0;

  // 1. MOVIE SIMILARITY
  const mapA = new Map(ratingsA.map(e => [String(e.toId), e.weight]));
  const mapB = new Map(ratingsB.map(e => [String(e.toId), e.weight]));

  const commonMovies = Array.from(mapA.keys()).filter(mid => mapB.has(mid));
  
  let movieSim = 0;
  if (commonMovies.length > 0) {
    let dotM = 0;
    for (const mid of commonMovies) {
      dotM += mapA.get(mid)! * mapB.get(mid)!;
    }
    const normMA = Math.sqrt(ratingsA.reduce((sum, e) => sum + e.weight**2, 0));
    const normMB = Math.sqrt(ratingsB.reduce((sum, e) => sum + e.weight**2, 0));
    movieSim = dotM / (normMA * normMB);
  }

  // 2. GENRE SIMILARITY (Profile based)
  const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const getGenreProfile = (ratings: any[]) => {
    const profile = new Map<string, number>();
    for (const edge of ratings) {
      const genre = normalize(grafo.getMovieGenre(edge.toId));
      profile.set(genre, (profile.get(genre) || 0) + edge.weight);
    }
    return profile;
  };

  const profileA = getGenreProfile(ratingsA);
  const profileB = getGenreProfile(ratingsB);

  const commonGenres = Array.from(profileA.keys()).filter(g => profileB.has(g));
  
  let genreSim = 0;
  if (commonGenres.length > 0) {
    let dotG = 0;
    for (const g of commonGenres) {
      dotG += profileA.get(g)! * profileB.get(g)!;
    }
    const normGA = Math.sqrt(Array.from(profileA.values()).reduce((sum, v) => sum + v**2, 0));
    const normGB = Math.sqrt(Array.from(profileB.values()).reduce((sum, v) => sum + v**2, 0));
    genreSim = dotG / (normGA * normGB);
  }

  // 3. COMBINATION
  // If we have common movies, they are a stronger signal.
  // If not, genre similarity is our only hope for cold-start.
  if (commonMovies.length > 0) {
    return (movieSim * 0.6) + (genreSim * 0.4);
  }
  
  // No movies in common? Use purely genre. 
  // If genre matches perfectly (e.g. only Comedy vs only Comedy), sim will be 1.0
  return genreSim;
}
