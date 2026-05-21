'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Star, Film, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { getTMDBImageUrl, TMDBMovie, TMDB_GENRES } from '../../lib/tmdb';
import Image from 'next/image';
import { db, auth } from '../../lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import MovieDetails from '../../components/MovieDetails';

type RecommendationSource = 'taste' | 'community' | 'trending';

const SOURCE_LABEL: Record<RecommendationSource, { label: string; color: string }> = {
  taste:     { label: 'Combinação de gostos',    color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400' },
  community: { label: 'Em alta na comunidade',   color: 'text-amber-600  bg-amber-50  dark:bg-amber-900/30  dark:text-amber-400'  },
  trending:  { label: 'Em alta no mundo',         color: 'text-teal-600   bg-teal-50   dark:bg-teal-900/30   dark:text-teal-400'   },
};

interface Recommendation {
  movieId: string;
  title: string;
  genre: string;
  genres: string[];
  poster_path: string | null;
  source: RecommendationSource;
  score: number;
}

interface UserRating {
  movie_id: number;
  rating: number;
}

function RecommendationsList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('user_id');
  const userName = searchParams.get('user_name') || userId;
  const topN = searchParams.get('top_n') || '10';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [myRatings, setMyRatings] = useState<UserRating[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfile(data);
          const q = query(collection(db, 'ratings'), where('user_id', '==', data.user_id));
          const snap = await getDocs(q);
          const ratingsMap = new Map<string, UserRating>();
          snap.docs.forEach(d => {
            const r = d.data() as UserRating;
            const mid = String(r.movie_id);
            const existing = ratingsMap.get(mid);
            if (!existing || (d.data().created_at?.seconds || 0) > 0) {
              ratingsMap.set(mid, r);
            }
          });
          setMyRatings(Array.from(ratingsMap.values()));
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    async function fetchRecommendations() {
      if (!userId) { setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, top_n: topN }),
        });
        const data = await response.json();
        if (!response.ok) {
          let msg = data.error || 'Falha ao carregar recomendações';
          if (data.details) msg += ` (DB: ${data.details.foundUsersCount} users)`;
          throw new Error(msg);
        }
        setRecommendations(data.recommendations || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRecommendations();
  }, [userId, topN]);

  const handleRateMovie = async (movie: TMDBMovie, rating: number) => {
    const user = auth.currentUser;
    if (!user || !profile) return;
    try {
      const uid = profile.user_id;
      const mid = movie.id;
      await setDoc(doc(db, 'movies', String(mid)), {
        movie_id: mid,
        id: mid,
        title: movie.title,
        genre: movie.genres?.[0]?.name || TMDB_GENRES[movie.genre_ids?.[0]] || 'Geral',
        genres: movie.genres?.map(g => g.name).filter(Boolean) || (movie.genre_ids || []).map(id => TMDB_GENRES[id]).filter(Boolean),
        poster_path: movie.poster_path,
        overview: movie.overview,
        updated_at: new Date(),
      }, { merge: true });
      await setDoc(doc(db, 'ratings', `${uid}_${mid}`), {
        user_id: uid,
        movie_id: mid,
        rating,
        user_email: user.email,
        uid: user.uid,
        created_at: new Date(),
      });
      setMyRatings(prev => {
        const filtered = prev.filter(r => String(r.movie_id) !== String(mid));
        return [...filtered, { movie_id: mid, rating }];
      });
      // Remove from recommendations list — user has now watched/rated this film
      setRecommendations(prev => prev.filter(r => r.movieId !== String(mid)));
      setSelectedMovieId(null);
    } catch (e: any) {
      console.error('Error saving rating:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#141414] rounded-3xl shadow-sm border border-neutral-200 dark:border-[#2a2a2a]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-neutral-600 dark:text-neutral-300 font-medium">Construindo grafo e executando algoritmos...</p>
        <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-2">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-red-900 mb-2">Erro ao Processar</h2>
        <p className="text-red-700 max-w-md">{error}</p>
        <button onClick={() => router.push('/')} className="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <header className="flex items-center justify-between mb-6 md:mb-8 gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium transition-colors group flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="text-right">
            <h1 className="text-lg md:text-2xl font-bold text-neutral-900 dark:text-white leading-tight">Recomendações para {userName}</h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs md:text-sm">Baseadas em seu perfil</p>
          </div>
        </header>

        {recommendations.length === 0 ? (
          <div className="bg-white dark:bg-[#141414] rounded-2xl p-12 text-center border border-neutral-200 dark:border-[#2a2a2a]">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Nenhuma recomendação no momento.</h3>
            <p className="text-neutral-500 dark:text-neutral-400 italic mb-6">Avalie mais filmes para melhorar as sugestões.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-4 h-4" /> Atualizar
            </button>
          </div>
        ) : (
          recommendations
            .filter(rec => !myRatings.find(r => String(r.movie_id) === rec.movieId))
            .map((rec, index) => {
            const mid = Number(rec.movieId);
            const userRating = myRatings.find(r => String(r.movie_id) === String(rec.movieId))?.rating;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedMovieId(mid)}
                className="bg-white dark:bg-[#141414] p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-neutral-100 dark:border-[#2a2a2a] flex items-center gap-3 md:gap-6 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-indigo-950/30 cursor-pointer"
              >
                {/* Rank */}
                <span className="text-xl md:text-3xl font-black text-neutral-200 dark:text-[#2a2a2a] group-hover:text-indigo-100 dark:group-hover:text-indigo-900 transition-colors tabular-nums min-w-[28px] md:min-w-[40px] flex-shrink-0">
                  {(index + 1).toString().padStart(2, '0')}
                </span>

                {/* Poster */}
                <div className="w-14 h-20 md:w-20 md:h-28 bg-neutral-50 dark:bg-[#1a1a1a] rounded-xl md:rounded-2xl overflow-hidden shadow-sm relative flex-shrink-0">
                  {rec.poster_path ? (
                    <Image
                      src={getTMDBImageUrl(rec.poster_path)}
                      alt={rec.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Film className="w-5 h-5 text-neutral-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-neutral-900 dark:text-white text-base md:text-xl leading-tight mb-1 line-clamp-2">{rec.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] md:text-[10px] font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full uppercase tracking-widest">
                      {rec.genre || 'Geral'}
                    </span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-2.5 h-2.5 md:w-3 md:h-3 ${i < Math.round(rec.score) ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'}`} />
                      ))}
                    </div>
                    {userRating && (
                      <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Sua nota: {userRating}★
                      </span>
                    )}
                  </div>
                  {/* Source badge — subtle, no-TMDB mention */}
                  {rec.source && SOURCE_LABEL[rec.source] && (
                    <p className={`text-[9px] font-bold mt-1.5 px-2 py-0.5 rounded-full inline-block ${SOURCE_LABEL[rec.source].color}`}>
                      {SOURCE_LABEL[rec.source].label}
                    </p>
                  )}
                  <p className="text-[10px] text-indigo-400 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center gap-1">
                    <span>▶</span> Ver trailer e detalhes
                  </p>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                    {rec.score.toFixed(2)}
                  </div>
                  <div className="text-[9px] md:text-[10px] text-neutral-300 dark:text-neutral-600 font-black uppercase tracking-widest">Conf.</div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {selectedMovieId && (
        <MovieDetails
          movieId={selectedMovieId}
          onClose={() => setSelectedMovieId(null)}
          onRate={handleRateMovie}
          userRating={myRatings.find(r => String(r.movie_id) === String(selectedMovieId))?.rating}
        />
      )}
    </>
  );
}

export default function RecommendationsPage() {
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-[#0a0a0a] p-3 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#141414] rounded-3xl shadow-sm border border-neutral-200 dark:border-[#2a2a2a]">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-neutral-600 dark:text-neutral-300 font-medium">Carregando...</p>
          </div>
        }>
          <RecommendationsList />
        </Suspense>

        <footer className="mt-12 text-center pb-8">
          <p className="text-neutral-400 dark:text-neutral-600 text-[10px] uppercase font-mono tracking-[0.2em]">
            Powered by Graph Theory & Collaborative Filtering
          </p>
        </footer>
      </div>
    </div>
  );
}
