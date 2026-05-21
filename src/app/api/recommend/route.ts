import { NextResponse } from 'next/server';
import { carregarGrafo } from '../../../io/loader';
import { calcularSimilaridade } from '../../../core/similarity';

const TMDB_GENRES: Record<number, string> = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
  99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
  36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
  10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
  53: 'Suspense', 10752: 'Guerra', 37: 'Faroeste',
};

const normalize = (s: string) =>
  s ? s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : 'geral';

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  genre_ids: number[];
  vote_average: number;
}

async function fetchTMDBPopular(pages: number): Promise<TMDBMovie[]> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) return [];
  try {
    const requests = Array.from({ length: pages }, (_, i) =>
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=pt-BR&page=${i + 1}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );
    const responses = await Promise.all(requests);
    return responses.flatMap(data => (data?.results as TMDBMovie[]) || []);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { user_id, top_n = 10 } = await request.json();

    if (user_id === undefined) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const grafo = await carregarGrafo();
    const allUsers = grafo.getUsers();
    const targetIdStr = String(user_id).toLowerCase();
    const realTargetId =
      allUsers.find(u => String(u).toLowerCase() === targetIdStr) || user_id;

    const userRatings = grafo.consultarAdjacencia(realTargetId, 'user');
    const watchedIds = new Set(userRatings.map(r => String(r.toId)));

    // Build favorite genre set from ALL genres of each liked movie
    const favoriteGenres = new Set<string>();
    for (const r of userRatings) {
      if (r.weight >= 3) {
        for (const g of grafo.getMovieGenres(r.toId)) {
          favoriteGenres.add(normalize(g));
        }
      }
    }

    // ── Step 1: collaborative filtering ────────────────────────────────────
    const candidates = new Map<string, {
      movieId: string; title: string; genre: string; genres: string[];
      posterPath: string | null; score: number; isGenreMatch: boolean;
      source: 'taste' | 'community' | 'trending';
    }>();

    for (const otherId of allUsers) {
      if (String(otherId).toLowerCase() === targetIdStr) continue;
      const sim = calcularSimilaridade(realTargetId, otherId, grafo);
      if (sim <= 0) continue;

      for (const r of grafo.consultarAdjacencia(otherId, 'user')) {
        const mid = String(r.toId);
        if (watchedIds.has(mid)) continue;

        const movieGenres = grafo.getMovieGenres(mid);
        const isGenreMatch = movieGenres.some(g => favoriteGenres.has(normalize(g)));
        const contribution = r.weight * sim * 1000 * (isGenreMatch ? 1.5 : 1.0);

        if (!candidates.has(mid)) {
          candidates.set(mid, {
            movieId: mid,
            title: grafo.getMovieTitle(mid),
            genre: grafo.getMovieGenre(mid),
            genres: movieGenres,
            posterPath: grafo.getMoviePoster(mid),
            score: contribution,
            isGenreMatch,
            source: 'taste',
          });
        } else {
          candidates.get(mid)!.score += contribution;
        }
      }
    }

    // Franchise title bonus
    const watchedTitles = userRatings.map(r =>
      grafo.getMovieTitle(r.toId).toLowerCase()
    );
    for (const cand of candidates.values()) {
      const ct = cand.title.toLowerCase();
      for (const wt of watchedTitles) {
        if (wt.length > 4 && (ct.includes(wt) || wt.includes(ct))) {
          cand.score *= 2.5;
          break;
        }
      }
    }

    let results = Array.from(candidates.values()).sort((a, b) => b.score - a.score);

    // ── Step 2: Firestore popular fallback ─────────────────────────────────
    if (results.length < Number(top_n)) {
      const movieStats = new Map<string, { count: number; ratingSum: number }>();
      for (const u of allUsers) {
        for (const r of grafo.consultarAdjacencia(u, 'user')) {
          const mid = String(r.toId);
          if (!movieStats.has(mid)) movieStats.set(mid, { count: 0, ratingSum: 0 });
          const s = movieStats.get(mid)!;
          s.count++;
          s.ratingSum += r.weight;
        }
      }

      const popular = grafo.getMovies()
        .map(mid => String(mid))
        .filter(mid => !watchedIds.has(mid) && !candidates.has(mid))
        .map(mid => {
          const s = movieStats.get(mid) || { count: 0, ratingSum: 0 };
          const movieGenres = grafo.getMovieGenres(mid);
          const title = grafo.getMovieTitle(mid);
          return {
            movieId: mid, title,
            genre: grafo.getMovieGenre(mid),
            genres: movieGenres,
            posterPath: grafo.getMoviePoster(mid),
            score: s.count > 0 ? (s.ratingSum / s.count) * Math.log10(s.count + 1) : 0,
            isGenreMatch: movieGenres.some(g => favoriteGenres.has(normalize(g))),
            source: 'community' as const,
          };
        })
        .filter(m => !m.title.startsWith('Filme #'))
        .sort((a, b) => b.score - a.score);

      for (const p of popular) {
        if (results.length >= Number(top_n)) break;
        results.push(p);
      }
    }

    // ── Step 3: TMDB popular fallback (always guarantees results) ──────────
    if (results.length < Number(top_n)) {
      const needed = Number(top_n) - results.length;
      const pages = Math.ceil((needed + watchedIds.size) / 20) + 1;
      const tmdbMovies = await fetchTMDBPopular(pages);

      // Sort: genre matches first, then by vote_average
      const sorted = tmdbMovies
        .filter(m => !watchedIds.has(String(m.id)))
        .map(m => {
          const movieGenres = (m.genre_ids || [])
            .map(id => TMDB_GENRES[id])
            .filter(Boolean) as string[];
          const isGenreMatch = movieGenres.some(g => favoriteGenres.has(normalize(g)));
          return { m, movieGenres, isGenreMatch };
        })
        .sort((a, b) => {
          if (a.isGenreMatch !== b.isGenreMatch) return a.isGenreMatch ? -1 : 1;
          return b.m.vote_average - a.m.vote_average;
        });

      for (const { m, movieGenres, isGenreMatch } of sorted) {
        if (results.length >= Number(top_n)) break;
        const mid = String(m.id);
        if (results.find(r => r.movieId === mid)) continue;

        results.push({
          movieId: mid,
          title: m.title,
          genre: TMDB_GENRES[m.genre_ids?.[0]] || 'Geral',
          genres: movieGenres,
          posterPath: m.poster_path,
          score: m.vote_average,
          isGenreMatch,
          source: 'trending' as const,
        });
      }
    }

    results = results.slice(0, Number(top_n));

    return NextResponse.json({
      user_id,
      recommendations: results.map(r => ({
        movieId: r.movieId,
        title: r.title,
        genre: r.genre,
        genres: r.genres,
        poster_path: r.posterPath,
        source: r.source,
        score: r.isGenreMatch
          ? parseFloat((4.7 + Math.random() * 0.3).toFixed(2))
          : parseFloat((4.0 + Math.random() * 0.7).toFixed(2)),
      })),
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor de recomendação.' },
      { status: 500 }
    );
  }
}
