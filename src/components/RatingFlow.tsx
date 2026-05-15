'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Star, CheckCircle2, ChevronRight, LogIn, Mail, Lock, UserPlus, Loader2, Film } from 'lucide-react';
import { getPopularMovies, TMDBMovie, TMDB_GENRES } from '../lib/tmdb';

export default function RatingFlow({ onComplete }: { onComplete: (userId: any) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<'login' | 'signup' | 'rating' | 'complete'>('login');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [onboardingMovies, setOnboardingMovies] = useState<TMDBMovie[]>([]);
  const [assignedId, setAssignedId] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [submitError, setSubmitError] = useState('');
  
  useEffect(() => {
    async function loadOnboarding() {
      const popular = await getPopularMovies();
      if (popular && popular.length > 0) {
        setOnboardingMovies(popular.slice(0, 10));
      } else {
        // Fallback para quando a API falha ou chave está ausente
        setOnboardingMovies([
          { id: 101, title: "O Poderoso Chefão", genre_ids: [80, 18], overview: "Drama épico sobre uma família mafiosa.", poster_path: "/3bhkrjRseERfsMZ7XRwvZqR9YvL.jpg", backdrop_path: null, release_date: "1972-03-14", vote_average: 8.7 },
          { id: 102, title: "Pulp Fiction", genre_ids: [80, 53], overview: "Várias histórias de crime se entrelaçam.", poster_path: "/d5iIlDwy0uS6vOPrbZ0H092oTqf.jpg", backdrop_path: null, release_date: "1994-09-10", vote_average: 8.5 },
          { id: 103, title: "Interestelar", genre_ids: [12, 18, 878], overview: "Viagem espacial para salvar a humanidade.", poster_path: "/nCbk9uGr59SCYN6B6sLRbkpYQGR.jpg", backdrop_path: null, release_date: "2014-11-05", vote_average: 8.4 },
          { id: 104, title: "Batman: O Cavaleiro das Trevas", genre_ids: [18, 28, 80, 53], overview: "Batman enfrenta o Coringa em Gotham.", poster_path: "/qJ2tW6WMUDp9sDeuGgYvOTvHtmT.jpg", backdrop_path: null, release_date: "2008-07-16", vote_average: 8.5 },
          { id: 105, title: "A Origem", genre_ids: [28, 12, 878], overview: "Invasão de sonhos e extração de segredos.", poster_path: "/8IB2wSTnbtpuln7vD6kz3qUo3Ky.jpg", backdrop_path: null, release_date: "2010-07-15", vote_average: 8.3 }
        ] as any);
      }
    }
    loadOnboarding();
  }, []);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      setAuthError('');
      
      if (u) {
        setCheckingProfile(true);
        try {
          // Usamos o UID diretamente como ID do documento para ser 100% certeiro e rápido
          const userDocRef = doc(db, "users", u.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            // Usuário já existe, recuperamos o ID profissional dele
            const userData = userDoc.data();
            const uid = userData.user_id !== undefined ? userData.user_id : u.uid;
            setAssignedId(uid);
            setStep('complete');
          } else {
            // Novo usuário logado (Primeira vez)
            // Usamos uma Transação para garantir que o ID seja sequencial e único
            const counterRef = doc(db, "metadata", "users_counter");
            
            let newNumericId;
            try {
              newNumericId = await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                let nextId = 1;
                if (counterSnap.exists()) {
                  nextId = (counterSnap.data().count || 0) + 1;
                }
                transaction.set(counterRef, { count: nextId }, { merge: true });
                return nextId;
              });
            } catch (err) {
              console.warn("Transaction failed, using UID as fallback", err);
              newNumericId = u.uid;
            }
            
            await setDoc(userDocRef, {
              user_id: newNumericId,
              email: u.email,
              uid: u.uid,
              created_at: new Date()
            });
            
            setAssignedId(newNumericId);
            setTimeout(() => setStep('rating'), 400);
          }
        } catch (e: any) {
          console.error("Erro ao processar perfil:", e);
          if (e.code === 'permission-denied') {
            setAuthError("Erro de Permissão: O banco ainda está liberando seu acesso. Tente clicar em entrar novamente em alguns segundos.");
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
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError("Erro ao entrar com Google.");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (isSignup: boolean) => {
    if (!email || !password) {
      setAuthError("Preencha todos os campos.");
      return;
    }
    setAuthError('');
    setLoading(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // O useEffect onAuthStateChanged cuidará do redirecionamento
    } catch (error: any) {
      setLoading(false);
      console.error("Auth Error:", error.code, error.message);
      
      if (isSignup) {
        if (error.code === 'auth/invalid-email') {
          setAuthError("E-mail inválido.");
        } else if (error.code === 'auth/email-already-in-use') {
          setAuthError("Este e-mail já está em uso.");
        } else if (error.code === 'auth/weak-password') {
          setAuthError("A senha deve ter pelo menos 6 caracteres.");
        } else {
          setAuthError(`Erro no cadastro: ${error.message || "Tente novamente."}`);
        }
      } else {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
          setAuthError("E-mail ou senha incorretos.");
        } else {
          setAuthError(`Erro no login: ${error.message || "Tente novamente."}`);
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

    const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
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
      console.error('Firestore Error:', JSON.stringify(errInfo));
      throw new Error(JSON.stringify(errInfo));
    };

    try {
      for (const [movieId, rating] of Object.entries(ratings)) {
        const mid = movieId;
        const uid = assignedId;
        
        // Ensure movie exists in collection
        const movieData = onboardingMovies.find(m => String(m.id) === String(mid));
        if (movieData) {
          const mDocRef = doc(db, "movies", String(mid));
          await setDoc(mDocRef, {
            movie_id: Number(mid),
            id: Number(mid),
            title: movieData.title,
            genre: TMDB_GENRES[movieData.genre_ids?.[0]] || "Geral",
            poster_path: movieData.poster_path,
            overview: movieData.overview,
            updated_at: new Date()
          }, { merge: true });
        }

        const rId = `${uid}_${mid}`;
        await setDoc(doc(db, "ratings", rId), {
          user_id: uid,
          movie_id: Number(mid),
          rating: Number(rating),
          user_email: user.email,
          uid: user.uid,
          created_at: new Date()
        });
      }
      setStep('complete');
    } catch (error: any) {
      console.error("Error saving ratings", error);
      let displayError = error.message;
      try {
        const parsed = JSON.parse(error.message);
        displayError = parsed.error;
      } catch (e) {
        // Not a JSON error
      }
      setSubmitError(`Erro ao salvar: ${displayError}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingProfile) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-xl p-12 border border-neutral-100 min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-neutral-400 text-sm mt-4 font-medium uppercase tracking-widest">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-xl p-8 border border-neutral-100 min-h-[400px] flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {(step === 'login' || step === 'signup') && (
          <motion.div 
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 flex flex-col"
          >
            <div className="text-center mb-8">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {step === 'login' ? <LogIn className="w-8 h-8 text-indigo-600" /> : <UserPlus className="w-8 h-8 text-indigo-600" />}
              </div>
              <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                {step === 'login' ? 'Bem-vindo de volta' : 'Criar nova conta'}
              </h2>
              <p className="text-neutral-500 text-xs mt-1 uppercase font-bold tracking-widest">
                {step === 'login' ? 'Entre para ver suas recomendações' : 'Cadastre-se para começar'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="email" 
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="password" 
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              {authError && (
                <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg">{authError}</p>
              )}

              <button
                onClick={() => handleEmailAuth(step === 'signup')}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (step === 'login' ? 'Entrar' : 'Cadastrar')}
              </button>

              <div className="relative py-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
                <span className="relative px-4 bg-white text-[10px] font-bold text-neutral-300 uppercase tracking-widest">ou use</span>
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google
              </button>

              <p className="text-center text-xs text-neutral-400 font-medium">
                {step === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                <button 
                  onClick={() => setStep(step === 'login' ? 'signup' : 'login')}
                  className="text-indigo-600 font-bold ml-1 hover:underline"
                >
                  {step === 'login' ? 'Cadastre-se' : 'Faça login'}
                </button>
              </p>
            </div>
          </motion.div>
        )}

        {step === 'rating' && (
          <motion.div 
            key="rating"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 flex flex-col"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-black text-neutral-900 tracking-tight">O que você gosta?</h2>
              <p className="text-neutral-500 text-xs mt-1 uppercase font-bold tracking-widest leading-relaxed">
                Avalie alguns filmes para gerarmos seu ID de usuário único.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[350px] custom-scrollbar">
              {onboardingMovies.map((movie) => (
                <div key={movie.id} className="flex items-center justify-between p-4 rounded-2xl border border-neutral-50 bg-neutral-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all group">
                  <span className="text-sm font-bold text-neutral-700 truncate max-w-[200px]">{movie.title}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(movie.id, star)}
                        className={`p-1 transition-all hover:scale-125 ${
                          (ratings[movie.id] || 0) >= star ? 'text-amber-400' : 'text-neutral-200'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${(ratings[movie.id] || 0) >= star ? 'fill-amber-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              {submitError && (
                <p className="text-red-500 text-[10px] font-bold text-center bg-red-50 py-2 rounded-lg mb-3">{submitError}</p>
              )}
              <button
                disabled={Object.keys(ratings).length < 2 || loading}
                onClick={handleSubmitRatings}
                className="w-full bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finalizar Perfil'} <ChevronRight className="w-4 h-4" />
              </button>
              <p className="text-[10px] text-neutral-400 mt-3 text-center uppercase tracking-widest font-bold">Avalie pelo menos 2 filmes para continuar</p>
            </div>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div 
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-6"
          >
            <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-green-100">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            
            <div className="mb-8">
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Cadastro Concluído!</h2>
              <p className="text-neutral-500 text-xs mt-2 uppercase font-bold tracking-[0.2em]">Sua conta está ativa e vinculada</p>
            </div>
            
            <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-100 w-full mb-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
              <span className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.3em] relative z-10">ID de Usuário</span>
              <p className="text-5xl font-black text-indigo-600 mt-2 tracking-tighter relative z-10">{assignedId}</p>
              <p className="text-[9px] text-neutral-400 mt-4 italic">Utilize este ID para gerar suas recomendações personalizadas.</p>
            </div>

            <button
              onClick={() => onComplete(assignedId || 0)}
              className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-neutral-200"
            >
              Ir para o Painel <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
