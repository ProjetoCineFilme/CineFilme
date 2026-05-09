import { BiGraph } from '../core/graph';

export interface Recommendation {
  movieId: number;
  title: string;
  score: number;
}

/**
 * Ranks candidate movies based on weighted similarity score.
 */
export function rankear(
  userId: number, 
  candidatos: number[], 
  vizinhosSim: Map<number, number>, 
  grafo: BiGraph
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const movieId of candidatos) {
    const connectionsToMovie = grafo.consultarAdjacencia(movieId, 'movie');
    
    let weightedSum = 0;
    let similaritySum = 0;

    for (const conn of connectionsToMovie) {
      const neighborId = conn.toId;
      if (vizinhosSim.has(neighborId)) {
        const similarity = vizinhosSim.get(neighborId)!;
        weightedSum += similarity * conn.weight;
        similaritySum += similarity;
      }
    }

    if (similaritySum > 0) {
      const score = weightedSum / similaritySum;
      recommendations.push({
        movieId,
        title: grafo.getMovieTitle(movieId),
        score: parseFloat(score.toFixed(2))
      });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score);
}
