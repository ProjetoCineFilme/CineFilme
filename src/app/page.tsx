'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Sparkles, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RatingFlow from '../components/RatingFlow';
import Dashboard from '../components/Dashboard';
import CineFilmeLogo from '../components/CineFilmeLogo';

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

  const handleComplete = async () => {
    const u = auth.currentUser;
    if (u) {
      try {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }
      } catch (e) {
        console.error("Erro ao atualizar perfil:", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] font-sans selection:bg-indigo-100">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-[#0a0a0a]"
          >
            <div className="text-center mb-12 max-w-sm">
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="flex items-center justify-center mx-auto mb-8"
              >
                <CineFilmeLogo size="lg" showTagline={true} accent="#7c5cff" />
              </motion.div>
              <p className="text-neutral-500 dark:text-neutral-400 text-lg leading-snug font-medium">
                Descubra seu próximo favorito através de conexões inteligentes.
              </p>
            </div>
            
            <RatingFlow onComplete={handleComplete} />
          </motion.div>
        ) : !profile ? (
          <motion.div 
            key="onboarding"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen flex items-center justify-center p-6 dark:bg-[#0a0a0a]"
          >
            <RatingFlow onComplete={handleComplete} />
          </motion.div>
        ) : (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen dark:bg-[#0a0a0a]"
          >
            <Dashboard user={user} profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

