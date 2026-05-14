import { NextResponse } from 'next/server';
import { carregarGrafo } from '../../../io/loader';
import { calcularSimilaridade } from '../../../core/similarity';
import { buscarCandidatos } from '../../../algorithms/bfs';
import { rankear } from '../../../algorithms/recommender';

const STANDARD_MOVIE_IDS = [101, 102, 103, 104, 105, 106, 107, 108];

export async function POST(request: Request) {
  try {
    const { user_id, top_n = 10, k = 5 } = await request.json();

    if (user_id === undefined) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const targetUserId = user_id; // Removido o Number() para suportar UIDs de string se surgirem
    
    // 1. Load Graph
    const grafo = await carregarGrafo();
    const allUsers = grafo.getUsers();
    
    // Obter filmes já assistidos pelo usuário alvo para filtrar em todos os caminhos
    const targetIdStr = String(targetUserId).toLowerCase();
    const realTargetId = allUsers.find(u => String(u).toLowerCase() === targetIdStr) || targetUserId;
    
    const userRatings = grafo.consultarAdjacencia(realTargetId, 'user');
    const watchedIds = new Set(userRatings.map(r => String(r.toId)));

    // Helper de normalização para gêneros
    const normalize = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "geral";

    let topNRecommendations: any[] = [];

    // Gêneros favoritos do usuário (score >= 3)
    const myGenres = new Set(
      userRatings
        .filter(r => r.weight >= 3)
        .map(r => normalize(grafo.getMovieGenre(r.toId)))
    );

    // Tentar Recomendação Colaborativa (CF)
    if (allUsers.length > 1 && userRatings.length > 0) {
      const similarities: { userId: any; sim: number }[] = [];
      for (const otherUserId of allUsers) {
        const sOtherId = String(otherUserId);
        if (sOtherId.toLowerCase() === targetIdStr) continue;
        
        const sim = calcularSimilaridade(realTargetId, otherUserId, grafo);
        if (sim > 0) {
          similarities.push({ userId: otherUserId, sim });
        }
      }

      if (similarities.length > 0) {
        const topKNeighbors = similarities
          .sort((a, b) => b.sim - a.sim)
          .slice(0, Number(k));

        const neighborMap = new Map();
        topKNeighbors.forEach(n => neighborMap.set(String(n.userId), n.sim));
        
        const neighborIds = topKNeighbors.map(n => n.userId);
        const candidates = buscarCandidatos(realTargetId, neighborIds, grafo);
        const allRecommendations = rankear(realTargetId, candidates, neighborMap, grafo);
        
        // Boost agressivo por gênero
        topNRecommendations = allRecommendations.map(r => {
          const g = normalize(grafo.getMovieGenre(r.movieId));
          const genreMatch = myGenres.has(g) ? 5.0 : 1.0;
          return { ...r, score: r.score * genreMatch };
        })
        .sort((a, b) => b.score - a.score);
      }
    }

    // "Super Fallback" Colaborativo: Se a CF tradicional falhou ou trouxe pouco, 
    // buscamos filmes bem avaliados (nota 5) por QUALQUER outro usuário nos gêneros que eu gosto.
    if (topNRecommendations.length < Number(top_n)) {
      const otherUserHighRatings: any[] = [];
      
      for (const otherUserId of allUsers) {
        if (String(otherUserId).toLowerCase() === targetIdStr) continue;
        
        const otherRatings = grafo.consultarAdjacencia(otherUserId, 'user');
        for (const r of otherRatings) {
          const mid = String(r.toId);
          if (!watchedIds.has(mid) && r.weight >= 4) {
             const genre = normalize(grafo.getMovieGenre(mid));
             if (myGenres.has(genre)) {
                // Candidato forte!
                if (!topNRecommendations.some(curr => String(curr.movieId) === mid)) {
                  otherUserHighRatings.push({
                    movieId: mid,
                    title: grafo.getMovieTitle(mid),
                    score: r.weight * 1.5 // Garante que fique acima dos classics
                  });
                }
             }
          }
        }
      }

      // Adiciona esses candidatos por gênero de outros usuários
      const uniqueOthers = Array.from(new Map(otherUserHighRatings.map(m => [m.movieId, m])).values())
        .sort((a, b) => b.score - a.score);
      
      topNRecommendations = [...topNRecommendations, ...uniqueOthers];
    }

    // Fallback logic: Se não completar top_n, busca outros filmes da base
    if (topNRecommendations.length < Number(top_n)) {
      const allMovies = grafo.getMovies();
      const additional = allMovies
        .filter(mid => {
          const sMid = String(mid);
          return !watchedIds.has(sMid) && !topNRecommendations.some(r => String(r.movieId) === sMid);
        })
        .sort((a, b) => {
          const genreA = normalize(grafo.getMovieGenre(a));
          const genreB = normalize(grafo.getMovieGenre(b));
          
          // Pontuação: Gênero (Prioridade Máxima) > Popularidade
          const scoreA = myGenres.has(genreA) ? 100000 : 0;
          const scoreB = myGenres.has(genreB) ? 100000 : 0;
          
          const popA = grafo.consultarAdjacencia(a, 'movie').length;
          const popB = grafo.consultarAdjacencia(b, 'movie').length;
          
          return (scoreB + popB) - (scoreA + popA) || Math.random() - 0.5;
        })
        .slice(0, Math.max(0, Number(top_n) - topNRecommendations.length))
        .map(mid => ({
          movieId: mid,
          title: grafo.getMovieTitle(mid),
          score: myGenres.has(normalize(grafo.getMovieGenre(mid))) ? 5.0 : 3.0
        }));
      
      topNRecommendations = [...topNRecommendations, ...additional];
    }

    // Se ainda assim for zero (improvável se houver filmes), usa os clássicos como rede de segurança final
    if (topNRecommendations.length === 0) {
       const classics = [
         { movieId: "101", title: "O Poderoso Chefão", score: 4.8 },
         { movieId: "102", title: "Pulp Fiction", score: 4.7 },
         { movieId: "103", title: "Interstellar", score: 4.6 },
         { movieId: "104", title: "Batman: O Cavaleiro das Trevas", score: 4.5 },
         { movieId: "105", title: "Gente Grande", score: 4.0 },
         { movieId: "106", title: "Esposa de Mentirinha", score: 4.0 },
       ].filter(c => !watchedIds.has(String(c.movieId)));
       
       topNRecommendations = classics.slice(0, Number(top_n));
       // Fallback do fallback
       if (topNRecommendations.length === 0) topNRecommendations = classics.slice(0, 3);
    }

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: topNRecommendations.map(r => ({
        movieId: r.movieId,
        title: r.title,
        score: Number(Number(r.score).toFixed(2))
      }))
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ error: "Erro interno no servidor de recomendação." }, { status: 500 });
  }
}
