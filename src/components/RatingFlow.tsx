'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Star, CheckCircle2, ChevronRight, LogIn } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

const POPULAR_MOVIES = [
  { movie_id: 101, title: "O Poderoso Chefão" },
  { movie_id: 102, title: "Pulp Fiction" },
  { movie_id: 103, title: "Interstellar" },
  { movie_id: 104, title: "Batman: O Cavaleiro das Trevas" },
  { movie_id: 105, title: "Clube da Luta" },
  { movie_id: 106, title: "Matrix" },
  { movie_id: 107, title: "Parasita" },
  { movie_id: 108, title: "Cidade de Deus" },
];

export default function RatingFlow({ onComplete }: { onComplete: (userId: number) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<'login' | 'rating' | 'complete'>('login');
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [assignedId, setAssignedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        // Check if user already has a numeric ID
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", u.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setAssignedId(userData.user_id);
          setStep('complete');
        } else {
          setStep('rating');
        }
      }
      setCheckingProfile(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error", error);
    }
  };

  const handleRate = (movieId: number, rating: number) => {
    setRatings(prev => ({ ...prev, [movieId]: rating }));
  };

  const handleSubmitRatings = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Generate a numeric ID for the user
      const newNumericId = Math.floor(Date.now() % 1000000) + 1000;
      setAssignedId(newNumericId);

      // 2. Save user mapping
      const usersRef = collection(db, "users");
      await addDoc(usersRef, {
        user_id: newNumericId,
        email: user.email,
        uid: user.uid,
        created_at: new Date()
      });

      // 3. Save ratings to Firestore
      const ratingsRef = collection(db, "ratings");
      for (const [movieId, rating] of Object.entries(ratings)) {
        await addDoc(ratingsRef, {
          user_id: newNumericId,
          movie_id: Number(movieId),
          rating: rating,
          user_email: user.email,
          created_at: new Date()
        });
      }

      setStep('complete');
    } catch (error) {
      console.error("Error saving ratings", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-neutral-100 min-h-[400px] flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'login' && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="bg-indigo-50 p-4 rounded-full">
              <LogIn className="w-10 h-10 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Entrar no CineFilme</h2>
              <p className="text-neutral-500 text-sm mt-1">Faça login para salvar suas preferências e obter seu ID.</p>
            </div>
            <button
              onClick={handleLogin}
              className="px-8 py-3 bg-white border border-neutral-200 rounded-xl shadow-sm hover:bg-neutral-50 transition-all flex items-center gap-3 text-neutral-700 font-medium active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Continuar com Google
            </button>
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
              <h2 className="text-xl font-bold text-neutral-900">O que você gosta?</h2>
              <p className="text-neutral-500 text-sm">Avalie pelo menos alguns filmes para nos ajudar a te conhecer.</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[400px]">
              {POPULAR_MOVIES.map((movie) => (
                <div key={movie.movie_id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <span className="text-sm font-medium text-neutral-800">{movie.title}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(movie.movie_id, star)}
                        className={`p-1 transition-transform hover:scale-110 ${
                          (ratings[movie.movie_id] || 0) >= star ? 'text-amber-400' : 'text-neutral-200'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${(ratings[movie.movie_id] || 0) >= star ? 'fill-amber-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={Object.keys(ratings).length < 2 || loading}
              onClick={handleSubmitRatings}
              className="mt-8 w-full bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'Salvando...' : 'Finalizar Perfil'} <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-neutral-400 mt-2 text-center italic">Avalie pelo menos 2 filmes para continuar.</p>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div 
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="bg-green-50 p-4 rounded-full">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">Tudo pronto!</h2>
              <p className="text-neutral-500 text-sm mt-1">Seu perfil foi criado com sucesso.</p>
            </div>
            
            <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 w-full">
              <span className="text-xs text-neutral-400 uppercase font-bold tracking-widest">Seu ID de Usuário</span>
              <p className="text-4xl font-black text-indigo-600 mt-1">{assignedId}</p>
            </div>

            <button
              onClick={() => assignedId && onComplete(assignedId)}
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Ir para Recomendações <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
