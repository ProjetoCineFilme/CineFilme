'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, ArrowRight, Play, UserPlus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RatingFlow from '../components/RatingFlow';

export default function LandingPage() {
  const [userId, setUserId] = useState('');
  const [topN, setTopN] = useState('10');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    router.push(`/recommendations?user_id=${userId}&top_n=${topN}`);
  };

  const handleOnboardingComplete = (newId: number) => {
    setUserId(newId.toString());
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 font-sans">
      <AnimatePresence mode="wait">
        {!showOnboarding ? (
          <motion.div 
            key="main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <div className="bg-white rounded-3xl shadow-2xl p-8 border border-neutral-100 mb-6 relative overflow-hidden" id="landing-card">
              <div className="absolute top-0 right-0 p-4">
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-indigo-100">
                  <Sparkles className="w-3 h-3" /> Graph Based
                </div>
              </div>

              <div className="flex flex-col items-center mb-8 mt-4 text-center">
                <div className="bg-indigo-600 p-4 rounded-2xl mb-4 shadow-xl shadow-indigo-200">
                  <Film className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                  CineFilme 
                  <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-full font-mono font-normal">NEXT.JS</span>
                </h1>
                <p className="text-neutral-500 mt-2 text-sm max-w-[280px]">
                  Descubra seu próximo favorito através de conexões inteligentes.
                </p>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="userId" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                    ID do Usuário
                  </label>
                  <input
                    id="userId"
                    type="number"
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Ex: 1, 2, 3..."
                    className="w-full px-4 py-4 rounded-2xl border border-neutral-100 bg-neutral-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-lg font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="topN" className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
                    Quantidade de Recomendações
                  </label>
                  <input
                    id="topN"
                    type="number"
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    min="1"
                    max="50"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>

                <button
                  id="submit-btn"
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  Gerar Recomendações <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-neutral-50">
                <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-4 text-center">Base de Teste (MovieLens)</h3>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((id) => (
                    <button
                      key={id}
                      onClick={() => setUserId(id.toString())}
                      className={`w-10 h-10 rounded-xl text-xs font-bold transition-all border ${
                        userId === id.toString() 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-white text-neutral-400 border-neutral-100 hover:border-indigo-200 hover:text-indigo-600'
                      }`}
                    >
                      #{id}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setShowOnboarding(true)}
                className="group w-full bg-white border border-indigo-100 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-500 transition-all shadow-sm"
              >
                <div className="bg-indigo-50 p-3 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-600 font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">Primeira vez aqui?</h4>
                  <p className="text-xs text-neutral-500 uppercase tracking-tighter">Crie seu perfil e obtenha seu ID único</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-neutral-300" />
              </button>

              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/seed', { method: 'POST' });
                    const data = await res.json();
                    alert(data.message || data.error);
                  } catch (e) {
                    alert("Erro ao popular banco.");
                  }
                }}
                className="text-[9px] text-neutral-400 hover:text-indigo-600 uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-2 py-2"
              >
                <Play className="w-2 h-2 fill-current" /> Restaurar Banco de Dados de Exemplo
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-lg"
          >
            <div className="mb-4">
              <button 
                onClick={() => setShowOnboarding(false)}
                className="text-xs font-bold text-neutral-400 hover:text-neutral-900 flex items-center gap-2 transition-colors uppercase tracking-widest"
              >
                ← Voltar para o início
              </button>
            </div>
            <RatingFlow onComplete={handleOnboardingComplete} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component reference fixes
import { ChevronRight as ChevronRightIcon } from 'lucide-react';
const ChevronRight = ChevronRightIcon;
