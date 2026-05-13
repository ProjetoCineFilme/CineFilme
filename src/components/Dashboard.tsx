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
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface Movie {
  movie_id: number;
  title: string;
  genre?: string;
  added_by?: string;
}

const STANDARD_MOVIE_IDS = [101, 102, 103, 104, 105, 106, 107, 108];
const GENRES = ["Ação", "Aventura", "Comédia", "Drama", "Ficção Científica", "Fantasia", "Terror", "Suspense", "Animação", "Documentário", "Romance", "Crime", "Super-herói", "Guerra", "Musical"];

interface Rating {
  movie_id: number;
  rating: number;
  created_at: any;
}

export default function Dashboard({ user, profile }: { user: any, profile: any }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [myRatings, setMyRatings] = useState<Rating[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingMovie, setIsAddingMovie] = useState(false);
  const [newMovieTitle, setNewMovieTitle] = useState('');
  const [newMovieGenre, setNewMovieGenre] = useState('Ação');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get all movies
      const moviesSnap = await getDocs(collection(db, "movies"));
      const moviesList = moviesSnap.docs.map(doc => {
        const data = doc.data();
        return { 
          movie_id: data.movie_id, 
          title: data.title || "Filme sem título",
          genre: data.genre || "Geral",
          added_by: data.added_by
        };
      });
      setMovies(moviesList);

      // Get my ratings
      const uid = profile.user_id;
      const q = query(collection(db, "ratings"), where("user_id", "==", uid));
      const ratingsSnap = await getDocs(q);
      
      // Map and deduplicate by movie_id (keep latest)
      const ratingsMap = new Map<string, Rating>();
      ratingsSnap.docs.forEach(doc => {
        const r = doc.data() as Rating;
        const mid = String(r.movie_id);
        const existing = ratingsMap.get(mid);
        // If not exists or this one is newer
        if (!existing || (r.created_at?.seconds || 0) > (existing.created_at?.seconds || 0)) {
          ratingsMap.set(mid, r);
        }
      });
      
      const ratingsList = Array.from(ratingsMap.values());
      // Sort manually to avoid index requirement
      ratingsList.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setMyRatings(ratingsList);
    } catch (e) {
      console.error("Dashboard data load error:", e);
    }
  };

  const normalizeTitle = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]/g, "")     // Remove tudo que não é letra ou número
      .trim();
  };

  const handleAddMovie = async () => {
    if (!newMovieTitle.trim()) return;
    setLoading(true);

    const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email },
        operationType,
        path
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      throw new Error(JSON.stringify(errInfo));
    };

    try {
      const normalizedNew = normalizeTitle(newMovieTitle);
      const duplicate = movies.find(m => normalizeTitle(m.title) === normalizedNew);

      if (duplicate) {
        setFeedback(`"${duplicate.title}" já está cadastrado. Procure-o na lista abaixo para avaliar!`);
        setNewMovieTitle('');
        setIsAddingMovie(false);
        setSearchTerm(duplicate.title); // Foca no filme existente e filtra a lista
        setTimeout(() => setFeedback(''), 5000);
        return;
      }

      // Find highest movie_id
      const querySnapshot = await getDocs(query(collection(db, "movies"), orderBy("movie_id", "desc"), limit(1)));
      let nextId = 5001; 
      if (!querySnapshot.empty) {
        nextId = (querySnapshot.docs[0].data().movie_id || 5000) + 1;
      }

      await addDoc(collection(db, "movies"), {
        movie_id: nextId,
        title: newMovieTitle.trim(),
        genre: newMovieGenre,
        created_at: new Date(),
        added_by: user.uid
      });

      setNewMovieTitle('');
      setNewMovieGenre('Ação');
      setIsAddingMovie(false);
      setFeedback('Filme cadastrado! Avalie-o para melhorar as recomendações.');
      setTimeout(() => setFeedback(''), 5000);
      fetchData();
    } catch (e: any) {
      console.error("Add movie error:", e);
      setFeedback(`Erro ao adicionar: ${e.message}`);
    } finally {
      setTimeout(() => fetchData(), 500); 
      setLoading(false);
    }
  };

  const handleRateMovie = async (movieId: any, rating: number) => {
    const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email },
        operationType,
        path
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      throw new Error(JSON.stringify(errInfo));
    };

    try {
      const uid = profile.user_id;
      const mid = movieId;
      const rVal = Number(rating);
      
      const ratingId = `${uid}_${mid}`;
      await setDoc(doc(db, "ratings", ratingId), {
        user_id: uid,
        movie_id: mid,
        rating: rVal,
        user_email: user.email,
        uid: user.uid,
        created_at: new Date()
      });
      
      setFeedback('Avaliação salva!');
      setTimeout(() => setFeedback(''), 3000);
      fetchData();
    } catch (e: any) {
      console.error("Rating error:", e);
      setFeedback(`Erro ao avaliar: ${e.message}`);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Tem certeza que deseja apagar todo o seu histórico de avaliações? Isso não pode ser desfeito.")) return;
    
    setLoading(true);

    const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email },
        operationType,
        path
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      throw new Error(JSON.stringify(errInfo));
    };

    try {
      const uid = profile.user_id;
      const q = query(collection(db, "ratings"), where("user_id", "==", uid));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit().catch(e => handleFirestoreError(e, 'delete', 'ratings/BATCH'));
      
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

  const filteredMovies = movies.filter(m => {
    const sTerm = searchTerm.trim().toLowerCase();
    
    // Se estiver pesquisando, mostra qualquer filme que bata com a busca
    if (sTerm) {
      return (m.title || "").toLowerCase().includes(sTerm) ||
             (m.genre || "").toLowerCase().includes(sTerm);
    }

    // Se não estiver pesquisando, mostra:
    // 1. Filmes padrão (101-108)
    const isStandard = STANDARD_MOVIE_IDS.includes(Number(m.movie_id));
    // 2. Cadastrados por mim
    const addedByMe = m.added_by === user.uid;
    // 3. Já avaliados por mim
    const ratedByMe = myRatings.some(r => String(r.movie_id) === String(m.movie_id));
    
    return isStandard || addedByMe || ratedByMe;
  }).slice(0, 12);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Painel CineFilme</h1>
            <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <UserIcon className="w-3 h-3" /> Usuário: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{profile.name || profile.email?.split('@')[0] || "Teste"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href={`/recommendations?user_id=${profile.user_id}&user_name=${encodeURIComponent(profile.name || profile.email?.split('@')[0] || "Teste")}&top_n=10`}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Gerar Recomendações
          </Link>
          <button 
            onClick={() => auth.signOut()}
            className="bg-white border border-neutral-200 p-3 rounded-2xl hover:bg-red-50 hover:border-red-100 hover:text-red-500 transition-all group"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Search & Rate Section */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-neutral-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-600" /> Explorar Filmes
              </h2>
              <button 
                onClick={() => setIsAddingMovie(!isAddingMovie)}
                className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors uppercase tracking-widest flex items-center gap-2 border border-indigo-100"
              >
                <Plus className="w-4 h-4" /> Cadastrar Filme
              </button>
            </div>

            <AnimatePresence>
              {isAddingMovie && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 p-6 bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Nome do Filme</label>
                      <input 
                        autoFocus
                        type="text"
                        value={newMovieTitle}
                        onChange={(e) => setNewMovieTitle(e.target.value)}
                        placeholder="Ex: Interestelar 2..."
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Gênero</label>
                      <select 
                        value={newMovieGenre}
                        onChange={(e) => setNewMovieGenre(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none bg-white font-bold text-neutral-700"
                      >
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={handleAddMovie}
                      disabled={loading}
                      className="w-full md:w-auto bg-neutral-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50 h-[50px]"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mb-8">
              <input 
                type="text" 
                placeholder="Pesquisar por título no banco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-4 pl-12 rounded-2xl border border-neutral-100 bg-neutral-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-lg"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMovies.map(movie => {
                const myRating = myRatings.find(r => String(r.movie_id) === String(movie.movie_id))?.rating;
                return (
                  <div key={movie.movie_id} className="p-4 rounded-2xl border border-neutral-50 bg-neutral-50/30 hover:border-indigo-100 hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-neutral-800 text-sm truncate max-w-[180px]">{movie.title}</span>
                      <span className="text-[9px] text-neutral-300 font-mono">#{movie.movie_id}</span>
                    </div>
                    <div className="mb-3">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">
                        {movie.genre || "Geral"}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => {
                        const active = (myRating || 0) >= star;
                        return (
                          <button 
                            key={star}
                            onClick={() => handleRateMovie(movie.movie_id, star)}
                            className={`p-1 transition-all hover:scale-125 ${
                              active ? 'text-amber-400' : 'text-neutral-200 hover:text-amber-200'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${active ? 'fill-amber-400' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filteredMovies.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <p className="text-neutral-400 text-sm font-medium">Nenhum filme encontrado com esse nome.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Activity & Stats Sidebar */}
        <div className="space-y-8">
          <section className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <TrendingUp className="w-24 h-24 rotate-12" />
            </div>
            <h3 className="text-lg font-black tracking-tight mb-6 relative z-10">Suas Estatísticas</h3>
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">ID Único</p>
                <p className="text-4xl font-black">{profile.user_id}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Avaliações</p>
                <p className="text-4xl font-black">{myRatings.length}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-neutral-100">
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Destaques da Base
            </h3>
            <div className="space-y-3">
              {movies.slice(0, 3).map((m, i) => (
                <div key={i} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600 truncate mr-2">{m.title}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3].map(s => <Star key={s} className="w-2 h-2 fill-amber-400 text-amber-400" />)}
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-neutral-400 mt-2 italic">Novos filmes aparecem aqui conforme os usuários cadastram.</p>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-neutral-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" /> Histórico Recente
              </h3>
              {myRatings.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 uppercase"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>
            <div className="space-y-4">
              {myRatings.slice(0, 5).map((rating, i) => {
                const movie = movies.find(m => String(m.movie_id) === String(rating.movie_id));
                return (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center text-amber-500 font-bold border border-neutral-100 group-hover:bg-white transition-colors">
                      {rating.rating}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-neutral-700 truncate">{movie?.title || 'Filme Removido'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{movie?.genre || 'Geral'}</span>
                        <p className="text-[10px] text-neutral-400 font-mono tracking-tighter">
                          {rating.created_at?.toDate ? rating.created_at.toDate().toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {myRatings.length === 0 && (
                <p className="text-neutral-400 text-xs italic">Você ainda não avaliou nenhum filme.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {feedback && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 border border-neutral-800"
        >
          <div className="bg-green-500 p-1 rounded-full"><Check className="w-3 h-3 text-white" /></div>
          <span className="text-sm font-bold">{feedback}</span>
        </motion.div>
      )}
    </div>
  );
}
