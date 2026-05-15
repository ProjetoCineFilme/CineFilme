const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  videos?: {
    results: {
      key: string;
      site: string;
      type: string;
    }[];
  };
  "watch/providers"?: {
    results: Record<string, {
      link: string;
      flatrate?: { provider_name: string; logo_path: string }[];
      buy?: { provider_name: string; logo_path: string }[];
      rent?: { provider_name: string; logo_path: string }[];
    }>;
  };
}

export const getTMDBImageUrl = (path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') => {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

export async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim();
  if (!apiKey) {
    console.error('TMDB API Key missing in environment variables.');
    return null;
  }

  const queryParams = new URLSearchParams({
    api_key: apiKey,
    language: 'pt-BR',
    ...params,
  });

  try {
    const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error(`TMDB API Error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch from TMDB failed:', error);
    return null;
  }
}

export async function getPopularMovies() {
  const data = await fetchFromTMDB('/movie/popular');
  return data?.results as TMDBMovie[] || [];
}

export async function getTopRatedMovies() {
  const data = await fetchFromTMDB('/movie/top_rated');
  return data?.results as TMDBMovie[] || [];
}

export async function searchMovies(query: string) {
  const data = await fetchFromTMDB('/search/movie', { query });
  return data?.results as TMDBMovie[] || [];
}

export async function getMovieDetails(movieId: number) {
  return await fetchFromTMDB(`/movie/${movieId}`, { 
    append_to_response: 'videos,watch/providers' 
  }) as TMDBMovie | null;
}

export const TMDB_GENRES: Record<number, string> = {
  28: "Ação",
  12: "Aventura",
  16: "Animação",
  35: "Comédia",
  80: "Crime",
  99: "Documentário",
  18: "Drama",
  10751: "Família",
  14: "Fantasia",
  36: "História",
  27: "Terror",
  10402: "Música",
  9648: "Mistério",
  10749: "Romance",
  878: "Ficção Científica",
  10770: "Cinema TV",
  53: "Suspense",
  10752: "Guerra",
  37: "Faroeste"
};
