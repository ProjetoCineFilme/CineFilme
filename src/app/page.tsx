'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, ArrowRight, Play } from 'lucide-react';
import { motion } from 'motion/react';

export default function LandingPage() {
  const [userId, setUserId] = useState('');
  const [topN, setTopN] = useState('10');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    router.push(`/recommendations?user_id=${userId}&top_n=${topN}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-neutral-100 mb-6" id="landing-card">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-3 rounded-xl mb-4 shadow-lg shadow-indigo-200">
              <Film className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              CineFilme 
              <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-full font-mono font-normal">NEXT.JS</span>
            </h1>
            <p className="text-neutral-500 mt-2 text-center text-sm">
              MVP de Recomendação de Filmes baseada em Grafos
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium text-neutral-700 ml-1">
                ID do Usuário
              </label>
              <input
                id="userId"
                type="number"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Ex: 1, 2, 3..."
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="topN" className="text-sm font-medium text-neutral-700 ml-1">
                Quantidade de Recomendações
              </label>
              <input
                id="topN"
                type="number"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
                min="1"
                max="50"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              />
            </div>

            <button
              id="submit-btn"
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Ver recomendações <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-100">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">IDs sugeridos para teste</h3>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((id) => (
                <button
                  key={id}
                  onClick={() => setUserId(id.toString())}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-indigo-50 text-neutral-600 hover:text-indigo-600 rounded-lg text-xs font-medium transition-colors border border-transparent hover:border-indigo-100"
                >
                  Usuário #{id}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400 mt-4 text-center leading-relaxed">
              Estes IDs representam perfis pré-existentes na base de dados MovieLens. 
              Em produção, o ID seria detectado automaticamente via Login.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-amber-800 text-xs font-medium flex items-center justify-center gap-2">
            <Play className="w-3 h-3 fill-amber-800" /> Primeira vez aqui? 
          </p>
          <button 
            onClick={async () => {
              const res = await fetch('/api/seed', { method: 'POST' });
              const data = await res.json();
              alert(data.message || data.error);
            }}
            className="mt-2 text-[10px] bg-white border border-amber-200 px-4 py-2 rounded-lg text-amber-900 font-bold hover:bg-amber-100 transition-colors uppercase tracking-widest"
          >
            Popular Banco com Dados de Exemplo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
