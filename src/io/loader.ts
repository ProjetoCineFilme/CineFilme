import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BiGraph } from '../core/graph';

export async function carregarGrafo(): Promise<BiGraph> {
  const grafo = new BiGraph();

  // 1. Load Ratings
  const ratingsSnapshot = await getDocs(collection(db, 'ratings'));

  const uniqueRatings = new Map<string, { uid: string, mid: string, val: number }>();

  ratingsSnapshot.forEach((doc) => {
    const data = doc.data();
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

  // 2. Load Movies (Titles, Genres, Posters)
  const moviesSnapshot = await getDocs(collection(db, 'movies'));
  moviesSnapshot.forEach((doc) => {
    const data = doc.data();
    const rawMid = data.movie_id ?? data.movieId ?? data.id ?? doc.id;
    if (rawMid !== undefined) {
      const mid = String(rawMid);
      grafo.adicionarVertice(mid, 'movie');

      const title = data.title ?? data.nome;
      const poster = data.poster_path ?? data.cartaz ?? data.poster;

      if (title) grafo.setMovieTitle(mid, title);
      if (poster) grafo.setMoviePoster(mid, poster);

      // Support both genres[] array and legacy single genre string
      const rawGenres = data.genres ?? data.generos;
      const rawGenre = data.genre ?? data.genero ?? data.categoria;

      let genreArray: string[] = [];
      if (rawGenres && Array.isArray(rawGenres) && rawGenres.length > 0) {
        genreArray = rawGenres.filter(Boolean);
      } else if (rawGenre) {
        genreArray = [rawGenre];
      }

      if (genreArray.length > 0) grafo.setMovieGenres(mid, genreArray);
    }
  });

  return grafo;
}
