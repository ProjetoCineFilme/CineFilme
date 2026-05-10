'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Film, Sparkles, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RatingFlow from '../components/RatingFlow';
import Dashboard from '../components/Dashboard';

export default function CineFilmeApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          } else {
            setProfile(null); // Force onboarding
          }
        } catch (e) {
          console.error("Erro ao carregar perfil:", e);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans selection:bg-indigo-100">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
          >
            <div className="text-center mb-12 max-w-sm">
              <motion.div 
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="bg-indigo-600 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200"
              >
                <Film className="w-10 h-10 text-white" />
              </motion.div>
              <h1 className="text-5xl font-black text-neutral-900 tracking-tighter mb-4">CineFilme</h1>
              <p className="text-neutral-500 text-lg leading-snug font-medium">
                Descubra seu próximo favorito através de conexões inteligentes.
              </p>
            </div>
            
            <RatingFlow onComplete={() => window.location.reload()} />
          </motion.div>
        ) : !profile ? (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen flex items-center justify-center p-6"
          >
            <RatingFlow onComplete={() => window.location.reload()} />
          </motion.div>
        ) : (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen"
          >
            <Dashboard user={user} profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

