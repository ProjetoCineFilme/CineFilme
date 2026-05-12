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
  console.log(`Loader: Found ${ratingsSnapshot.size} ratings`);
  
  ratingsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.user_id !== undefined && data.movie_id !== undefined && data.rating !== undefined) {
      // Permitimos strings ou numbers aqui
      grafo.adicionarAresta(
        data.user_id,
        data.movie_id,
        Number(data.rating)
      );
    }
  });

  // 2. Load Movies (Titles & Genres)
  const moviesSnapshot = await getDocs(collection(db, 'movies'));
  console.log(`Loader: Found ${moviesSnapshot.size} movies`);
  moviesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.movie_id !== undefined) {
      const mid = data.movie_id;
      // Add node even if no ratings yet
      grafo.adicionarVertice(mid, 'movie');
      
      if (data.title) {
        grafo.setMovieTitle(mid, data.title);
      }
      if (data.genre) {
        grafo.setMovieGenre(mid, data.genre);
      }
    }
  });

  return grafo;
}
