'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Star, Film, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Recommendation {
  title: string;
  score: number;
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

  useEffect(() => {
    async function fetchRecommendations() {
      if (!userId) {
        setLoading(false);
        return;
      }

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
          if (data.details) {
             msg += ` (DB: ${data.details.foundUsersCount} users)`;
          }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-neutral-200">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-neutral-600 font-medium">Construindo grafo e executando algoritmos...</p>
        <p className="text-neutral-400 text-xs mt-2">Isso pode levar alguns segundos dependendo do tamanho da base</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-8 flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-bold text-red-900 mb-2">Erro ao Processar</h2>
        <p className="text-red-700 max-w-md">{error}</p>
        
        <button 
          onClick={() => router.push('/')}
          className="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-red-700 transition-colors"
        >
          Tentar outro ID
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <header className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Voltar
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-neutral-900">Recomendações para {userName}</h1>
          <p className="text-neutral-500 text-sm">Baseadas em seu perfil de comportamento</p>
        </div>
      </header>

      {recommendations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-neutral-200">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-neutral-900 mb-2">Ops! Nenhuma recomendação agora.</h3>
          <p className="text-neutral-500 italic mb-6">
            Isso acontece se você já avaliou todos os filmes disponíveis ou se o sistema ainda está carregando os dados.
          </p>
          <div className="p-4 bg-neutral-50 rounded-xl inline-block text-left">
            <p className="text-xs font-bold text-neutral-400 uppercase mb-2">O que fazer?</p>
            <ul className="text-xs text-neutral-600 space-y-1 list-disc pl-4">
              <li>Cadastre novos filmes no painel principal</li>
              <li>Peça para outros amigos avaliarem para criar conexões</li>
              <li>Tente atualizar a página em alguns instantes</li>
            </ul>
          </div>
        </div>
      ) : (
        recommendations.map((rec, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex items-center justify-between hover:border-indigo-200 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <span className="text-xl font-black text-neutral-200 group-hover:text-indigo-100 transition-colors tabular-nums">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <div className="bg-indigo-50 p-2.5 rounded-lg">
                <Film className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-lg">{rec.title}</h3>
                <div className="flex items-center gap-1 mt-0.5">
                   <div className="flex gap-0.5">
                     {[...Array(5)].map((_, i) => (
                       <Star 
                         key={i} 
                         className={`w-3 h-3 ${i < Math.round(rec.score) ? 'text-amber-400 fill-amber-400' : 'text-neutral-200'}`} 
                       />
                     ))}
                   </div>
                   <span className="text-xs text-neutral-400 ml-1 font-mono uppercase tracking-tighter">Est. Rating</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-indigo-600 font-mono tracking-tighter">
                {rec.score.toFixed(2)}
              </div>
              <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest">Score</div>
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );
}

export default function RecommendationsPage() {
  return (
    <div className="min-h-screen bg-neutral-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-neutral-200">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-neutral-600 font-medium">Carregando...</p>
          </div>
        }>
          <RecommendationsList />
        </Suspense>

        <footer className="mt-12 text-center pb-8">
           <p className="text-neutral-400 text-[10px] uppercase font-mono tracking-[0.2em]">
             Powered by Graph Theory & MovieLens 100K
           </p>
        </footer>
      </div>
    </div>
  );
}
