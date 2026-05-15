'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  Play, 
  Calendar, 
  Globe, 
  Info,
  Tv,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { getMovieDetails, TMDBMovie, getTMDBImageUrl, TMDB_GENRES } from '../lib/tmdb';
import Image from 'next/image';

interface MovieDetailsProps {
  movieId: number;
  onClose: () => void;
  onRate: (movie: TMDBMovie, rating: number) => void;
  userRating?: number;
}

export default function MovieDetails({ movieId, onClose, onRate, userRating }: MovieDetailsProps) {
  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getMovieDetails(movieId);
      setMovie(data);
      setLoading(false);
    }
    load();
  }, [movieId]);

  const trailer = movie?.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const providers = movie?.['watch/providers']?.results?.BR;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-neutral-900 font-black text-xl">Buscando detalhes reais...</p>
        </div>
      </div>
    );
  }

  if (!movie) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-8 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[3rem] w-full max-w-5xl overflow-hidden relative shadow-2xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white p-3 rounded-full transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Post/Video Section */}
          <div className="lg:w-2/5 relative aspect-video lg:aspect-auto h-[400px] lg:h-auto bg-neutral-900">
            {showTrailer && trailer ? (
              <iframe 
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                className="w-full h-full border-none"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <>
                <Image 
                  src={getTMDBImageUrl(movie.poster_path, 'w780') || ""} 
                  alt={movie.title}
                  fill
                  className="object-cover opacity-60"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center bg-gradient-to-t from-black via-transparent to-transparent">
                  <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    {trailer ? (
                       <button 
                        onClick={() => setShowTrailer(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-6 rounded-full shadow-2xl shadow-indigo-500/50 transition-all active:scale-90"
                       >
                         <Play className="w-8 h-8 fill-white" />
                       </button>
                    ) : (
                      <Tv className="w-10 h-10 text-white/50" />
                    )}
                  </div>
                  {trailer && (
                    <p className="text-white font-black text-sm uppercase tracking-widest bg-black/50 px-6 py-2 rounded-full border border-white/20">Assista ao Trailer</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Info Section */}
          <div className="lg:w-3/5 p-8 lg:p-12 space-y-8 overflow-y-auto max-h-[80vh] lg:max-h-[90vh]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {movie.genres ? (
                  movie.genres.map(g => (
                    <span key={g.id} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      {g.name}
                    </span>
                  ))
                ) : (
                  movie.genre_ids?.map(gid => (
                    <span key={gid} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      {TMDB_GENRES[gid]}
                    </span>
                  ))
                )}
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-neutral-900 tracking-tighter leading-none">{movie.title}</h2>
              <div className="flex items-center gap-8 text-neutral-500 text-sm font-bold">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  {movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  {movie.vote_average.toFixed(1)} <span className="text-neutral-300 font-medium">/ 10</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" /> Sinopse
              </h3>
              <p className="text-neutral-600 leading-relaxed font-medium">
                {movie.overview || "Nenhuma descrição disponível em português."}
              </p>
            </div>

            {/* Watch Providers */}
            {providers && (
              <div className="space-y-6 bg-neutral-50 p-8 rounded-[2rem] border border-neutral-100">
                <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Onde Assistir
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(providers.flatrate || providers.buy || providers.rent) ? (
                    <>
                      {providers.flatrate && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest opacity-40">Streaming</p>
                          <div className="flex flex-wrap gap-3">
                            {providers.flatrate.map(p => (
                              <div key={p.provider_name} className="group relative" title={p.provider_name}>
                                <div className="w-12 h-12 relative rounded-xl overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                  <Image 
                                    src={getTMDBImageUrl(p.logo_path, 'w92') || ""} 
                                    alt={p.provider_name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(providers.buy || providers.rent) && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest opacity-40">Aluguel / Compra</p>
                          <div className="flex flex-wrap gap-3">
                            {[...(providers.buy || []), ...(providers.rent || [])].filter((v, i, a) => a.findIndex(t => t.provider_name === v.provider_name) === i).slice(0, 4).map(p => (
                              <div key={p.provider_name} className="group relative" title={p.provider_name}>
                                <div className="w-12 h-12 relative rounded-xl overflow-hidden border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                  <Image 
                                    src={getTMDBImageUrl(p.logo_path, 'w92') || ""} 
                                    alt={p.provider_name}
                                    fill
                                    className="object-cover opacity-80 group-hover:opacity-100"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-neutral-400 text-xs italic">Informações indisponíveis no momento.</p>
                  )}
                </div>
                
                <a 
                  href={providers.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:text-indigo-700 transition-colors pt-4 group"
                >
                  Ver todos no JustWatch <ExternalLink className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </a>
              </div>
            )}

            {/* User Rating */}
            <div className="pt-8 border-t border-neutral-100">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div>
                    <h3 className="text-lg font-black text-neutral-900 tracking-tight">Sua Avaliação</h3>
                    <p className="text-neutral-400 text-xs font-medium">Como você avalia este filme?</p>
                 </div>
                 <div className="flex gap-2">
                   {[1, 2, 3, 4, 5].map(star => {
                     const active = (userRating || 0) >= star;
                     return (
                       <button 
                         key={star}
                         onClick={() => onRate(movie, star)}
                         className={`p-2 rounded-2xl transition-all hover:scale-110 ${
                           active ? 'bg-amber-50 text-amber-400' : 'bg-neutral-50 text-neutral-200 hover:text-amber-300'
                         }`}
                       >
                         <Star className={`w-8 h-8 ${active ? 'fill-amber-400' : ''}`} />
                       </button>
                     );
                   })}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
