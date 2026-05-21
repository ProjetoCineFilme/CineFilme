import { BiGraph } from '../core/graph';
import firebaseConfig from '../../firebase-applet-config.json';

const PROJECT_ID = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type FsVal =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsVal[] } }
  | { mapValue: { fields?: Record<string, FsVal> } };

function parseVal(v: FsVal): unknown {
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  if ('arrayValue'   in v) return (v.arrayValue.values ?? []).map(parseVal);
  if ('mapValue'     in v) {
    const obj: Record<string, unknown> = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields ?? {})) obj[k] = parseVal(fv);
    return obj;
  }
  return undefined;
}

function parseDoc(doc: { fields?: Record<string, FsVal> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields ?? {})) out[k] = parseVal(v);
  return out;
}

async function fetchCollection(name: string): Promise<Record<string, unknown>[]> {
  const docs: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${BASE}/${name}?key=${API_KEY}&pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data: { documents?: { fields?: Record<string, FsVal> }[]; nextPageToken?: string } = await res.json();
    for (const d of data.documents ?? []) docs.push(parseDoc(d));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

export async function carregarGrafo(): Promise<BiGraph> {
  const grafo = new BiGraph();

  // 1. Load Ratings
  const ratings = await fetchCollection('ratings');
  const uniqueRatings = new Map<string, { uid: string; mid: string; val: number }>();
  for (const data of ratings) {
    const rawUid = data.user_id ?? data.userId ?? data.uid;
    const rawMid = data.movie_id ?? data.movieId ?? data.mid;
    const rawRating = data.rating ?? data.nota;
    if (rawUid !== undefined && rawMid !== undefined && rawRating !== undefined) {
      const uid = String(rawUid);
      const mid = String(rawMid);
      uniqueRatings.set(`${uid}_${mid}`, { uid, mid, val: Number(rawRating) });
    }
  }
  uniqueRatings.forEach(({ uid, mid, val }) => grafo.adicionarAresta(uid, mid, val));

  // 2. Load Movies (Titles, Genres, Posters)
  const movies = await fetchCollection('movies');
  for (const data of movies) {
    const rawMid = data.movie_id ?? data.movieId ?? data.id;
    if (rawMid === undefined) continue;
    const mid = String(rawMid);
    grafo.adicionarVertice(mid, 'movie');

    const title = data.title ?? data.nome;
    const poster = data.poster_path ?? data.cartaz ?? data.poster;
    if (title) grafo.setMovieTitle(mid, String(title));
    if (poster) grafo.setMoviePoster(mid, String(poster));

    const rawGenres = data.genres ?? data.generos;
    const rawGenre  = data.genre  ?? data.genero ?? data.categoria;
    let genreArray: string[] = [];
    if (Array.isArray(rawGenres) && rawGenres.length > 0) {
      genreArray = (rawGenres as unknown[]).map(String).filter(Boolean);
    } else if (rawGenre) {
      genreArray = [String(rawGenre)];
    }
    if (genreArray.length > 0) grafo.setMovieGenres(mid, genreArray);
  }

  return grafo;
}
