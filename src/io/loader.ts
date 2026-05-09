import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BiGraph } from '../core/graph';

/**
 * Loads the ratings and movie titles from Firestore and builds the BiGraph.
 */
export async function carregarGrafo(): Promise<BiGraph> {
  const grafo = new BiGraph();

  // 1. Load Ratings
  const ratingsSnapshot = await getDocs(collection(db, 'ratings'));
  ratingsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.user_id !== undefined && data.movie_id !== undefined && data.rating !== undefined) {
      grafo.adicionarAresta(
        Number(data.user_id),
        Number(data.movie_id),
        Number(data.rating)
      );
    }
  });

  // 2. Load Movies (Titles)
  const moviesSnapshot = await getDocs(collection(db, 'movies'));
  moviesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.movie_id !== undefined && data.title !== undefined) {
      grafo.setMovieTitle(Number(data.movie_id), data.title);
    }
  });

  return grafo;
}
