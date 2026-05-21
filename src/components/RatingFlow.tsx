'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, ChevronRight, LogIn, Mail, Lock, UserPlus, Loader2, Film, User as UserIcon } from 'lucide-react';
import { getMoviesByGenre, TMDBMovie, TMDB_GENRES, getTMDBImageUrl } from '../lib/tmdb';
import Image from 'next/image';
import StarRating from './StarRating';

const ONBOARDING_GENRES = [
  { id: 28,    name: 'Ação' },
  { id: 12,    name: 'Aventura' },
  { id: 16,    name: 'Animação' },
  { id: 35,    name: 'Comédia' },
  { id: 18,    name: 'Drama' },
  { id: 27,    name: 'Terror' },
  { id: 10749, name: 'Romance' },
  { id: 878,   name: 'Ficção Científica' },
  { id: 53,    name: 'Suspense' },
  { id: 80,    name: 'Crime' },
];

interface GenreSection {
  genre: string;
  genreId: number;
  movies: TMDBMovie[];
}

export default function RatingFlow({ onComplete }: { onComplete: (userId: any) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<'login' | 'signup' | 'rating' | 'complete'>('login');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [sections, setSections] = useState<GenreSection[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [assignedId, setAssignedId] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [submitError, setSubmitError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    async function loadOnboarding() {
      setLoadingMovies(true);
      try {
        const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim();
        if (!apiKey) {
          // Fallback when API key is missing
          setSections([{
            genre: 'Populares',
            genreId: 0,
            movies: [
              { id: 101, title: "O Poderoso Chefão", genre_ids: [80, 18], overview: "Drama épico sobre uma família mafiosa.", poster_path: "/3bhkrjRseERfsMZ7XRwvZqR9YvL.jpg", backdrop_path: null, release_date: "1972-03-14", vote_average: 8.7 },
              { id: 102, title: "Pulp Fiction", genre_ids: [80, 53], overview: "Histórias de crime se entrelaçam.", poster_path: "/d5iIlDwy0uS6vOPrbZ0H092oTqf.jpg", backdrop_path: null, release_date: "1994-09-10", vote_average: 8.5 },
              { id: 103, title: "Interestelar", genre_ids: [12, 18, 878], overview: "Viagem espacial para salvar a humanidade.", poster_path: "/nCbk9uGr59SCYN6B6sLRbkpYQGR.jpg", backdrop_path: null, release_date: "2014-11-05", vote_average: 8.4 },
              { id: 104, title: "Batman: O Cavaleiro das Trevas", genre_ids: [18, 28, 80], overview: "Batman enfrenta o Coringa.", poster_path: "/qJ2tW6WMUDp9sDeuGgYvOTvHtmT.jpg", backdrop_path: null, release_date: "2008-07-16", vote_average: 8.5 },
              { id: 105, title: "A Origem", genre_ids: [28, 12, 878], overview: "Invasão de sonhos.", poster_path: "/8IB2wSTnbtpuln7vD6kz3qUo3Ky.jpg", backdrop_path: null, release_date: "2010-07-15", vote_average: 8.3 },
            ] as any,
          }]);
          return;
        }

        const seenIds = new Set<number>();
        const result: GenreSection[] = [];

        for (const genre of ONBOARDING_GENRES) {
          const all = await getMoviesByGenre(genre.id);
          const unique: TMDBMovie[] = [];
          for (const m of all) {
            if (unique.length >= 5) break;
            if (!seenIds.has(m.id)) {
              seenIds.add(m.id);
              unique.push(m);
            }
          }
          if (unique.length > 0) {
            result.push({ genre: genre.name, genreId: genre.id, movies: unique });
          }
        }

        setSections(result);
      } finally {
        setLoadingMovies(false);
      }
    }
    loadOnboarding();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      setAuthError('');
      if (u) {
        setCheckingProfile(true);
        try {
          const userDocRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const uid = userData.user_id !== undefined ? userData.user_id : u.uid;
            setAssignedId(uid);
            setStep('complete');
          } else {
            const counterRef = doc(db, 'metadata', 'users_counter');
            let newNumericId;
            try {
              newNumericId = await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                let nextId = 1;
                if (counterSnap.exists()) nextId = (counterSnap.data().count || 0) + 1;
                transaction.set(counterRef, { count: nextId }, { merge: true });
                return nextId;
              });
            } catch (err) {
              newNumericId = u.uid;
            }
            await setDoc(userDocRef, {
              user_id: newNumericId,
              name: u.displayName || '',
              email: u.email,
              uid: u.uid,
              created_at: new Date(),
            });
            setAssignedId(newNumericId);
            setTimeout(() => setStep('rating'), 400);
          }
        } catch (e: any) {
          if (e.code === 'permission-denied') {
            setAuthError('Erro de permissão. Tente entrar novamente em alguns segundos.');
          } else {
            setAuthError(`Erro: ${e.message || 'Verifique sua conexão'}`);
          }
        } finally {
          setCheckingProfile(false);
          setLoading(false);
        }
      } else {
        setStep('login');
        setCheckingProfile(false);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setAuthError('Erro ao entrar com Google.');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (isSignup: boolean) => {
    if (!email || !password) { setAuthError('Preencha todos os campos.'); return; }
    setAuthError('');
    setLoading(true);
    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setLoading(false);
      if (isSignup) {
        if (error.code === 'auth/email-already-in-use') setAuthError('E-mail já está em uso.');
        else if (error.code === 'auth/weak-password') setAuthError('Senha deve ter pelo menos 6 caracteres.');
        else if (error.code === 'auth/invalid-email') setAuthError('E-mail inválido.');
        else setAuthError(`Erro: ${error.message}`);
      } else {
        if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential','auth/invalid-email'].includes(error.code)) {
          setAuthError('E-mail ou senha incorretos.');
        } else {
          setAuthError(`Erro: ${error.message}`);
        }
      }
    }
  };

  const handleRate = (movieId: any, rating: number) => {
    setRatings(prev => ({ ...prev, [String(movieId)]: rating }));
  };

  const handleSubmitRatings = async () => {
    if (!user || !assignedId) return;
    setLoading(true);
    setSubmitError('');
    try {
      const allMovies = sections.flatMap(s => s.movies);
      for (const [movieId, rating] of Object.entries(ratings)) {
        const mid = movieId;
        const uid = assignedId;
        const movieData = allMovies.find(m => String(m.id) === String(mid));
        if (movieData) {
          await setDoc(doc(db, 'movies', String(mid)), {
            movie_id: Number(mid),
            id: Number(mid),
            title: movieData.title,
            genre: TMDB_GENRES[movieData.genre_ids?.[0]] || 'Geral',
            genres: (movieData.genre_ids || []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
            poster_path: movieData.poster_path,
            overview: movieData.overview,
            updated_at: new Date(),
          }, { merge: true });
        }
        await setDoc(doc(db, 'ratings', `${uid}_${mid}`), {
          user_id: uid,
          movie_id: Number(mid),
          rating: Number(rating),
          user_email: user.email,
          uid: user.uid,
          created_at: new Date(),
        });
      }
      setStep('complete');
    } catch (error: any) {
      setSubmitError(`Erro ao salvar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const ratedCount = Object.keys(ratings).length;

  if (checkingProfile) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#141414] rounded-3xl shadow-xl p-12 border border-neutral-100 dark:border-[#2a2a2a] min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-4 font-medium uppercase tracking-widest">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#141414] rounded-3xl shadow-xl border border-neutral-100 dark:border-[#2a2a2a] flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
      <AnimatePresence mode="wait">

        {/* ── Login / Signup ── */}
        {(step === 'login' || step === 'signup') && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 flex flex-col p-8"
          >
            <div className="text-center mb-8">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {step === 'login' ? <LogIn className="w-8 h-8 text-indigo-600" /> : <UserPlus className="w-8 h-8 text-indigo-600" />}
              </div>
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                {step === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1 uppercase font-bold tracking-widest">
                {step === 'login' ? 'Entre para ver suas recomendações' : 'Cadastre-se para começar'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Nome — só no cadastro */}
              {step === 'signup' && (
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-100 dark:border-[#2a2a2a] bg-neutral-50 dark:bg-[#1c1c1c] focus:bg-white dark:focus:bg-[#222] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none dark:text-white dark:placeholder-neutral-500"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-100 dark:border-[#2a2a2a] bg-neutral-50 dark:bg-[#1c1c1c] focus:bg-white dark:focus:bg-[#222] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none dark:text-white dark:placeholder-neutral-500" />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-100 dark:border-[#2a2a2a] bg-neutral-50 dark:bg-[#1c1c1c] focus:bg-white dark:focus:bg-[#222] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none dark:text-white dark:placeholder-neutral-500" />
              </div>

              {authError && <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg">{authError}</p>}

              <button onClick={() => handleEmailAuth(step === 'signup')} disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (step === 'login' ? 'Entrar' : 'Cadastrar')}
              </button>

              <div className="relative py-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100 dark:border-[#2a2a2a]" /></div>
                <span className="relative px-4 bg-white dark:bg-[#141414] text-[10px] font-bold text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">ou use</span>
              </div>

              <button onClick={handleGoogleLogin}
                className="w-full bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#2a2a2a] hover:bg-neutral-50 dark:hover:bg-[#222] text-neutral-700 dark:text-neutral-200 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all">
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google
              </button>

              <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                {step === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
                <button onClick={() => setStep(step === 'login' ? 'signup' : 'login')} className="text-indigo-600 font-bold ml-1 hover:underline">
                  {step === 'login' ? 'Cadastre-se' : 'Faça login'}
                </button>
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Rating step ── */}
        {step === 'rating' && (
          <motion.div
            key="rating"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col h-full"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            {/* Header fixo */}
            <div className="p-6 pb-4 border-b border-neutral-50 dark:border-[#2a2a2a] flex-shrink-0">
              <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">O que você já assistiu?</h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1 leading-relaxed">
                Avalie os filmes que você conhece — isso nos ajuda a entender seu gosto e recomendar melhor.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 bg-neutral-100 dark:bg-[#2a2a2a] rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min((ratedCount / 10) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{ratedCount} avaliados</span>
              </div>
            </div>

            {/* Lista por gênero (scrollável) */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loadingMovies ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-neutral-400 text-sm font-medium">Buscando filmes...</p>
                </div>
              ) : (
                <div className="py-4 space-y-6">
                  {sections.map(section => (
                    <div key={section.genreId}>
                      <div className="px-6 mb-3 flex items-center gap-2">
                        <span className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-widest">{section.genre}</span>
                        <span className="text-[9px] font-black text-neutral-300 dark:text-neutral-600 uppercase tracking-widest">
                          ({section.movies.filter(m => ratings[m.id]).length}/{section.movies.length} avaliados)
                        </span>
                      </div>
                      {/* Scroll horizontal por gênero */}
                      <div className="flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-none" style={{ scrollSnapType: 'x mandatory' }}>
                        {section.movies.map(movie => {
                          const myRating = ratings[movie.id] || 0;
                          const poster = getTMDBImageUrl(movie.poster_path, 'w185');
                          return (
                            <div
                              key={movie.id}
                              className="flex-shrink-0 w-28"
                              style={{ scrollSnapAlign: 'start' }}
                            >
                              <div className={`relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-100 dark:bg-[#2a2a2a] mb-2 border-2 transition-all ${myRating > 0 ? 'border-indigo-400 shadow-md shadow-indigo-100' : 'border-transparent'}`}>
                                {poster ? (
                                  <Image src={poster} alt={movie.title} fill className="object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Film className="w-6 h-6 text-neutral-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                                {myRating > 0 && (
                                  <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    {myRating}★
                                  </div>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 line-clamp-2 leading-tight mb-1.5">{movie.title}</p>
                              <StarRating value={myRating} onChange={r => handleRate(movie.id, r)} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer fixo com botão */}
            <div className="p-6 pt-4 border-t border-neutral-50 dark:border-[#2a2a2a] flex-shrink-0">
              {submitError && <p className="text-red-500 text-[10px] font-bold text-center bg-red-50 py-2 rounded-lg mb-3">{submitError}</p>}
              <button
                disabled={ratedCount < 2 || loading}
                onClick={handleSubmitRatings}
                className="w-full bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Finalizar Perfil (${ratedCount} avaliados)`}
                {!loading && <ChevronRight className="w-4 h-4" />}
              </button>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2 text-center font-medium">Avalie pelo menos 2 filmes para continuar</p>
            </div>
          </motion.div>
        )}

        {/* ── Complete ── */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center p-8"
          >
            <div className="bg-green-50 dark:bg-green-900/20 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-green-100 dark:border-green-800">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Cadastro Concluído!</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-2 uppercase font-bold tracking-[0.2em]">Sua conta está ativa</p>

            <div className="bg-neutral-50 dark:bg-[#1a1a1a] p-8 rounded-3xl border border-neutral-100 dark:border-[#2a2a2a] w-full my-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12" />
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-[0.3em]">ID de Usuário</span>
              <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mt-2 tracking-tighter">{assignedId}</p>
            </div>

            <button onClick={() => onComplete(assignedId || 0)}
              className="w-full bg-neutral-900 dark:bg-white hover:bg-black dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-neutral-200 dark:shadow-neutral-900">
              Ir para o Painel <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
