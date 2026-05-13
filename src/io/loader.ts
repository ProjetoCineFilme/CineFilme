import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BiGraph } from '../core/graph';

/**
 * Loads the ratings and movie titles from Firestore and builds the BiGraph.
 */
export async function carregarGrafo(): Promise<BiGraph> {
  const grafo = new BiGraph();

  // 1. Load Ratings (Deduplicate to keep only latest per user-movie)
  const ratingsSnapshot = await getDocs(collection(db, 'ratings'));
  console.log(`Loader: Found ${ratingsSnapshot.size} raw ratings`);
  
    const uniqueRatings = new Map<string, { uid: string, mid: string, val: number }>();
  
  ratingsSnapshot.forEach((doc) => {
    const data = doc.data();
    // Suporte a múltiplas chaves e tipos de ID
    const rawUid = data.user_id ?? data.userId ?? data.uid;
    const rawMid = data.movie_id ?? data.movieId ?? data.mid;
    const rawRating = data.rating ?? data.nota;

    if (rawUid !== undefined && rawMid !== undefined && rawRating !== undefined) {
      const uid = String(rawUid);
      const mid = String(rawMid);
      const key = `${uid}_${mid}`;
      uniqueRatings.set(key, { uid, mid, val: Number(rawRating) });
    }
  });

  uniqueRatings.forEach(({ uid, mid, val }) => {
    grafo.adicionarAresta(uid, mid, val);
  });

  // 2. Load Movies (Titles & Genres)
  const moviesSnapshot = await getDocs(collection(db, 'movies'));
  moviesSnapshot.forEach((doc) => {
    const data = doc.data();
    const rawMid = data.movie_id ?? data.movieId ?? data.id;
    if (rawMid !== undefined) {
      const mid = String(rawMid);
      grafo.adicionarVertice(mid, 'movie');
      
      const title = data.title ?? data.nome;
      const genre = data.genre ?? data.genero ?? data.categoria;

      if (title) {
        grafo.setMovieTitle(mid, title);
      }
      if (genre) {
        grafo.setMovieGenre(mid, genre);
      }
    }
  });

  return grafo;
}
