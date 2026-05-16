'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit, doc, setDoc, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Star, 
  LogOut, 
  User as UserIcon, 
  Sparkles, 
  TrendingUp, 
  History,
  Film,
  Loader2,
  Check,
  Trash2,
  Info,
  Play,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { searchMovies, getPopularMovies, getTopRatedMovies, TMDBMovie, getTMDBImageUrl, TMDB_GENRES } from '../lib/tmdb';
import Image from 'next/image';

import MovieDetails from './MovieDetails';
import StarRating from './StarRating';

interface Movie {
  movie_id: number;
  title: string;
  genre: string;
  added_by?: string;
  poster_path?: string;
  overview?: string;
}

const STANDARD_MOVIE_IDS = [101, 102, 103, 104, 105, 106, 107, 108];

interface Rating {
  movie_id: number;
  rating: number;
  created_at: any;
}

export default function Dashboard({ user, profile }: { user: any, profile: any }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [myRatings, setMyRatings] = useState<Rating[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TMDBMovie[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'my-movies'>('explore');

  useEffect(() => {
    fetchData();
    loadTrends();
  }, []);

  const loadTrends = async () => {
    const popular = await getPopularMovies();
    if (popular && popular.length > 0) {
      setPopularMovies(popular);
      setIsApiKeyMissing(false);
    } else if (!process.env.NEXT_PUBLIC_TMDB_API_KEY) {
      setIsApiKeyMissing(true);
    }
  };

  const fetchData = async () => {
    try {
      // Get all movies from local cache
      const moviesSnap = await getDocs(collection(db, "movies"));
      const moviesList = moviesSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          movie_id: data.movie_id ?? data.movieId ?? data.id, 
          title: data.title || data.nome || "Filme sem título",
          genre: data.genre || data.genero || data.categoria || "Geral",
          added_by: data.added_by,
          poster_path: data.poster_path,
          overview: data.overview
        };
      });
      setMovies(moviesList);

      // Get my ratings
      const uid = profile.user_id;
      const q = query(collection(db, "ratings"), where("user_id", "==", uid));
      const ratingsSnap = await getDocs(q);
      
      const ratingsMap = new Map<string, Rating>();
      ratingsSnap.docs.forEach(doc => {
        const r = doc.data() as Rating;
        const mid = String(r.movie_id);
        const existing = ratingsMap.get(mid);
        if (!existing || (r.created_at?.seconds || 0) > (existing.created_at?.seconds || 0)) {
          ratingsMap.set(mid, r);
        }
      });
      
      const ratingsList = Array.from(ratingsMap.values());
      ratingsList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setMyRatings(ratingsList);
    } catch (e) {
      console.error("Dashboard data load error:", e);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length > 2) {
      const results = await searchMovies(val);
      setTmdbResults(results);
    } else {
      setTmdbResults([]);
    }
  };

  const handleRateMovie = async (tmdbMovie: TMDBMovie, rating: number) => {
    const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
        },
        operationType,
        path
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      return JSON.stringify(errInfo);
    };

    try {
      const uid = profile.user_id;
      const mid = tmdbMovie.id;
      
      // 1. Ensure movie exists in our "movies" collection for the graph loader
      const movieRef = doc(db, "movies", String(mid));
      try {
        await setDoc(movieRef, {
          movie_id: mid,
          id: mid,
          title: tmdbMovie.title,
          genre: tmdbMovie.genres?.[0]?.name || TMDB_GENRES[tmdbMovie.genre_ids?.[0]] || "Geral",
          genres: tmdbMovie.genres?.map(g => g.name).filter(Boolean) || (tmdbMovie.genre_ids || []).map(id => TMDB_GENRES[id]).filter(Boolean),
          poster_path: tmdbMovie.poster_path,
          overview: tmdbMovie.overview,
          updated_at: new Date()
        }, { merge: true });
      } catch (e) {
        console.warn("Could not sync movie metadata, continuing with rating...", handleFirestoreError(e, 'write', `movies/${mid}`));
      }

      // 2. Save rating
      const ratingId = `${uid}_${mid}`;
      await setDoc(doc(db, "ratings", ratingId), {
        user_id: uid,
        movie_id: mid,
        rating: rating,
        user_email: user.email,
        uid: user.uid,
        created_at: new Date()
      });
      
      setFeedback('Avaliação salva!');
      setTimeout(() => setFeedback(''), 3000);
      fetchData();
      setSelectedMovieId(null);
    } catch (e: any) {
      const displayErr = handleFirestoreError(e, 'write', 'ratings');
      console.error("Rating error:", e);
      setFeedback(`Erro ao avaliar: ${e.message}`);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Tem certeza que deseja apagar todo o seu histórico de avaliações? Isso não pode ser desfeito.")) return;
    setLoading(true);
    try {
      const uid = profile.user_id;
      const q = query(collection(db, "ratings"), where("user_id", "==", uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setFeedback('Histórico limpo com sucesso!');
      setTimeout(() => setFeedback(''), 3000);
      fetchData();
    } catch (e: any) {
      console.error("Clear history error:", e);
      setFeedback(`Erro ao limpar histórico: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRating = async (movieId: number, rating: number) => {
    try {
      const uid = profile.user_id;
      const ratingId = `${uid}_${movieId}`;
      await setDoc(doc(db, "ratings", ratingId), {
        user_id: uid,
        movie_id: movieId,
        rating,
        user_email: user.email,
        uid: user.uid,
        created_at: new Date()
      });
      setFeedback('Avaliação atualizada!');
      setTimeout(() => setFeedback(''), 3000);
      fetchData();
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-12 font-sans bg-neutral-50 min-h-screen">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-12 bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-neutral-100">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 md:p-4 rounded-[1rem] md:rounded-[1.5rem] shadow-xl shadow-indigo-100 flex-shrink-0">
            <Film className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-neutral-900 tracking-tighter">CineFilme <span className="text-indigo-200">AI</span></h1>
            <p className="text-neutral-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-1">
              <UserIcon className="w-3 h-3 text-indigo-400" />
              <span className="bg-neutral-50 px-3 py-1 rounded-full border border-neutral-100 truncate max-w-[140px] sm:max-w-none">{profile.name || 'Membro'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Link
            href={`/recommendations?user_id=${profile.user_id}&user_name=${encodeURIComponent(profile.name || 'Membro')}&top_n=10`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-8 py-3 md:py-4 rounded-2xl font-black flex items-center gap-2 md:gap-3 transition-all shadow-2xl shadow-indigo-100 active:scale-95 group overflow-hidden relative text-sm md:text-base"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 relative z-10 flex-shrink-0" />
            <span className="relative z-10 hidden xs:inline sm:hidden md:inline">Ver Recomendações</span>
            <span className="relative z-10 xs:hidden sm:inline md:hidden">Recomen.</span>
          </Link>
          <button
            onClick={() => auth.signOut()}
            className="bg-white border border-neutral-200 p-3 md:p-4 rounded-2xl hover:bg-red-50 hover:border-red-100 hover:text-red-500 transition-all active:scale-95 shadow-sm flex-shrink-0"
            title="Sair"
          >
            <LogOut className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-2 md:gap-3 mb-6 md:mb-8">
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex-1 sm:flex-none px-4 md:px-6 py-3 rounded-2xl font-black text-sm transition-all ${
            activeTab === 'explore'
              ? 'bg-neutral-900 text-white shadow-lg'
              : 'bg-white text-neutral-400 border border-neutral-100 hover:border-neutral-200'
          }`}
        >
          Explorar
        </button>
        <button
          onClick={() => setActiveTab('my-movies')}
          className={`flex-1 sm:flex-none px-4 md:px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'my-movies'
              ? 'bg-neutral-900 text-white shadow-lg'
              : 'bg-white text-neutral-400 border border-neutral-100 hover:border-neutral-200'
          }`}
        >
          <History className="w-4 h-4" />
          Meus Filmes
          {myRatings.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
              activeTab === 'my-movies' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {myRatings.length}
            </span>
          )}
        </button>
      </nav>

      {/* Meus Filmes Tab */}
      {activeTab === 'my-movies' && (
        <div>
          {myRatings.length === 0 ? (
            <div className="py-24 text-center bg-white rounded-[3rem] border border-neutral-100">
              <Film className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
              <p className="text-neutral-400 font-black text-sm">Você ainda não avaliou nenhum filme.</p>
              <button
                onClick={() => setActiveTab('explore')}
                className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all"
              >
                Explorar filmes
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {myRatings.map((rating) => {
                const movie = movies.find(m => String(m.movie_id) === String(rating.movie_id));
                return (
                  <div
                    key={rating.movie_id}
                    className="bg-white rounded-3xl overflow-hidden border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-neutral-200/80 transition-all group"
                  >
                    <div
                      className="relative aspect-[2/3] bg-neutral-100 cursor-pointer"
                      onClick={() => setSelectedMovieId(rating.movie_id)}
                    >
                      {movie?.poster_path ? (
                        <Image
                          src={getTMDBImageUrl(movie.poster_path) || ''}
                          alt={movie.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Film className="w-8 h-8 text-neutral-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <h4
                        className="font-black text-neutral-800 text-xs leading-tight line-clamp-2 cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={() => setSelectedMovieId(rating.movie_id)}
                      >
                        {movie?.title || `Filme #${rating.movie_id}`}
                      </h4>
                      {movie?.genre && (
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter inline-block">
                          {movie.genre}
                        </span>
                      )}
                      <div onClick={e => e.stopPropagation()}>
                        <StarRating
                          value={rating.rating}
                          onChange={(r) => handleUpdateRating(rating.movie_id, r)}
                          size="sm"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1 font-medium">
                          Nota: {rating.rating} ★
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      {activeTab === 'explore' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Search & Results Section */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Search Box */}
          <section className="bg-white rounded-[1.5rem] md:rounded-[3rem] p-5 md:p-10 shadow-sm border border-neutral-100 ring-1 ring-neutral-50">
            <div className="flex items-center justify-between mb-5 md:mb-8">
              <div>
                <h2 className="text-lg md:text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2 md:gap-3">
                  <Search className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" /> O que quer assistir?
                </h2>
                <p className="text-neutral-400 text-xs md:text-sm mt-1">Pesquise em milhões de filmes via TMDB.</p>
              </div>
            </div>

            <div className="relative group">
              <input
                type="text"
                placeholder={isApiKeyMissing ? 'Configure a TMDB_API_KEY...' : 'Ex: Oppenheimer, Batman...'}
                value={searchTerm}
                disabled={isApiKeyMissing}
                onChange={(e) => handleSearch(e.target.value)}
                className={`w-full px-4 py-4 pl-12 md:px-8 md:py-6 md:pl-16 rounded-2xl md:rounded-[2rem] border-2 border-neutral-50 bg-neutral-50/50 focus:bg-white focus:ring-4 md:focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none text-base md:text-xl font-medium placeholder:text-neutral-300 ${isApiKeyMissing ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-neutral-300 group-focus-within:text-indigo-400 transition-colors" />
              {loading && <Loader2 className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-indigo-600 animate-spin" />}
            </div>

            {isApiKeyMissing && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium leading-relaxed">
                  <span className="font-black">API do TMDB não configurada:</span> Vá em <span className="font-bold">Settings &gt; Environment Variables</span> e adicione <code className="bg-amber-100 px-1 rounded text-amber-900">NEXT_PUBLIC_TMDB_API_KEY</code> para habilitar a busca de filmes reais.
                </p>
              </div>
            )}

            {/* Search Results Dropdown-like Section */}
            <AnimatePresence>
              {tmdbResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-200"
                >
                  {tmdbResults.map(movie => {
                    const poster = getTMDBImageUrl(movie.poster_path);
                    const myRating = myRatings.find(r => String(r.movie_id) === String(movie.id))?.rating;
                    
                    return (
                      <div 
                        key={movie.id} 
                        onClick={() => setSelectedMovieId(movie.id)}
                        className="flex gap-4 p-4 rounded-3xl border border-neutral-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group cursor-pointer"
                      >
                        <div className="w-24 h-36 bg-neutral-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm relative">
                          {poster ? (
                            <Image 
                              src={poster} 
                              alt={movie.title} 
                              fill 
                              className="object-cover group-hover:scale-110 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Film className="w-8 h-8 text-neutral-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <h4 className="font-black text-neutral-800 text-sm line-clamp-2 leading-tight mb-1">{movie.title}</h4>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {movie.genre_ids.slice(0, 2).map(gid => (
                                <span key={gid} className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                  {TMDB_GENRES[gid]}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="space-y-2" onClick={e => e.stopPropagation()}>
                            <StarRating
                              value={myRating || 0}
                              onChange={(r) => handleRateMovie(movie, r)}
                              size="sm"
                            />
                            <p className="text-[10px] text-neutral-400 font-bold italic">
                              {myRating ? `Sua nota: ${myRating} ★` : 'Toque para avaliar'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Trending Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-red-500" /> Bombando no Mundo
              </h3>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Atualizado Agora</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {popularMovies.slice(0, 4).map(movie => (
                <div 
                  key={movie.id} 
                  className="group relative aspect-[2/3] rounded-[2rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer"
                  onClick={() => setSelectedMovieId(movie.id)}
                >
                  <Image 
                    src={getTMDBImageUrl(movie.poster_path) || ""} 
                    alt={movie.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                    <h4 className="text-white font-black text-xs mb-2 leading-tight">{movie.title}</h4>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-white text-[10px] font-bold">{movie.vote_average.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* User Score Card */}
          <section className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
             <div className="absolute -right-10 -bottom-10 opacity-10">
               <Sparkles className="w-48 h-48" />
             </div>
             <div className="relative z-10 space-y-8">
               <div>
                  <h3 className="text-lg font-black tracking-tight mb-8">Seu Repositório</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Avaliações</p>
                      <p className="text-5xl font-black tracking-tighter">{myRatings.length}</p>
                    </div>
                    <div>
                      <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Rank</p>
                      <p className="text-5xl font-black tracking-tighter">{myRatings.length > 20 ? 'Gold' : 'Cine'}</p>
                    </div>
                  </div>
               </div>
               <div className="pt-8 border-t border-indigo-500/30">
                 <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                   <Info className="w-3 h-3" /> Dica do Algoritmo
                 </p>
                 <p className="text-sm font-medium leading-relaxed">
                   Avalie mais 5 filmes de **Aventura** para aumentar a precisão do seu grafo de similaridade em 25%.
                 </p>
               </div>
             </div>
          </section>

          {/* Recent Activity */}
          <section className="bg-white rounded-[3rem] p-8 shadow-sm border border-neutral-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest flex items-center gap-3">
                <History className="w-4 h-4 text-indigo-600" /> Histórico Real
              </h3>
              {myRatings.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="text-[10px] font-black text-red-400 hover:text-red-500 transition-colors flex items-center gap-1 uppercase tracking-widest"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>
            <div className="space-y-6">
              {myRatings.slice(0, 6).map((rating, i) => {
                const movie = movies.find(m => String(m.movie_id) === String(rating.movie_id));
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    onClick={() => setSelectedMovieId(rating.movie_id)}
                    className="flex items-center gap-5 group cursor-pointer"
                  >
                    <div className="w-12 h-18 bg-neutral-50 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-100 relative">
                      {movie?.poster_path ? (
                        <Image 
                          src={getTMDBImageUrl(movie.poster_path)} 
                          alt={movie.title} 
                          fill 
                          className="object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : <Film className="w-4 h-4 text-neutral-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-neutral-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{movie?.title || 'Carregando...'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs font-black text-neutral-500">{rating.rating}</span>
                        </div>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded flex-shrink-0">
                          {movie?.genre || 'Geral'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {myRatings.length === 0 && (
                <div className="py-12 text-center bg-neutral-50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                  <Film className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                  <p className="text-neutral-400 text-xs font-bold italic px-8 leading-snug">Seu histórico está vazio. Comece a avaliar!</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
      )}

      {/* Floating Notifications */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-xl text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 z-50 border border-white/10"
          >
            <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>
            <span className="text-sm font-black tracking-tight">{feedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Movie Details Modal */}
      {selectedMovieId && (
        <MovieDetails 
          movieId={selectedMovieId} 
          onClose={() => setSelectedMovieId(null)}
          onRate={handleRateMovie}
          userRating={myRatings.find(r => String(r.movie_id) === String(selectedMovieId))?.rating}
        />
      )}
    </div>
  );
}
