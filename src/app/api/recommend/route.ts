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

    // 1. Descobrir interesses do usuário alvo
    const myGenreWeights = new Map<string, number>();
    userRatings.forEach(r => {
      const g = normalize(grafo.getMovieGenre(r.toId));
      const currentWeight = myGenreWeights.get(g) || 0;
      // Dá mais peso para notas altas
      myGenreWeights.set(g, currentWeight + (r.weight >= 4 ? 2 : 1));
    });

    const myTopGenres = Array.from(myGenreWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    let recommendationsMap = new Map<string, { movieId: string, title: string, score: number, reasons: string[] }>();

    // 2. Recomendação Colaborativa (CF) - Se houver dados suficientes
    if (allUsers.length > 1 && userRatings.length > 0) {
      const similarities: { userId: any; sim: number }[] = [];
      for (const otherUserId of allUsers) {
        if (String(otherUserId).toLowerCase() === targetIdStr) continue;
        const sim = calcularSimilaridade(realTargetId, otherUserId, grafo);
        if (sim > 0) similarities.push({ userId: otherUserId, sim });
      }

      if (similarities.length > 0) {
        const topKNeighbors = similarities.sort((a, b) => b.sim - a.sim).slice(0, Number(k));
        const neighborMap = new Map();
        topKNeighbors.forEach(n => neighborMap.set(String(n.userId), n.sim));
        
        const neighborIds = topKNeighbors.map(n => n.userId);
        const candidates = buscarCandidatos(realTargetId, neighborIds, grafo);
        const cfResults = rankear(realTargetId, candidates, neighborMap, grafo);
        
        cfResults.forEach(r => {
          const mid = String(r.movieId);
          const genre = normalize(grafo.getMovieGenre(mid));
          let score = r.score;
          
          // Boost se for do gênero favorito
          if (myGenreWeights.has(genre)) {
            score *= 2.0;
          }
          
          recommendationsMap.set(mid, {
            movieId: mid,
            title: r.title,
            score: score,
            reasons: ["Baseado em usuários similares"]
          });
        });
      }
    }

    // 3. Recomendação por Gênero + Avaliações de Terceiros (O que o usuário pediu!)
    // Buscamos filmes que outros usuários amaram (nota 5) nos gêneros que o alvo gosta
    const allMovies = grafo.getMovies();
    allMovies.forEach(movieId => {
      const mid = String(movieId);
      if (watchedIds.has(mid) || recommendationsMap.has(mid)) return;

      const genre = normalize(grafo.getMovieGenre(mid));
      if (myGenreWeights.has(genre)) {
        // Quantas pessoas deram nota alta para esse filme?
        const movieRatings = grafo.consultarAdjacencia(mid, 'movie');
        const highRatings = movieRatings.filter(r => r.weight >= 4);
        
        if (highRatings.length > 0) {
          // Score baseado na média de notas + popularidade no gênero + bonus por gênero favorito
          const avgRating = highRatings.reduce((acc, curr) => acc + curr.weight, 0) / highRatings.length;
          const genreBonus = (myTopGenres.indexOf(genre) === 0 ? 3.0 : 2.0);
          
          const score = avgRating * genreBonus;
          
          recommendationsMap.set(mid, {
            movieId: mid,
            title: grafo.getMovieTitle(mid),
            score: score,
            reasons: [`Destaque no gênero ${grafo.getMovieGenre(mid)}`]
          });
        }
      }
    });

    // 4. Fallback Global: Filmes populares em geral que ele não viu
    if (recommendationsMap.size < Number(top_n)) {
      const sortedAll = allMovies
        .filter(mid => !watchedIds.has(String(mid)) && !recommendationsMap.has(String(mid)))
        .map(mid => {
          const sMid = String(mid);
          const genre = normalize(grafo.getMovieGenre(mid));
          const pop = grafo.consultarAdjacencia(mid, 'movie').length;
          const genreMatch = myGenreWeights.has(genre) ? 10 : 0;
          return { mid: sMid, score: pop + genreMatch };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(top_n));

      sortedAll.forEach(item => {
        if (recommendationsMap.size >= Number(top_n)) return;
        recommendationsMap.set(item.mid, {
          movieId: item.mid,
          title: grafo.getMovieTitle(item.mid),
          score: 3.5,
          reasons: ["Popular na rede"]
        });
      });
    }

    // 5. Baseline: Se ainda não tiver nada, ou para completar, usa os clássicos
    if (recommendationsMap.size < 3) {
      const classics = [
        { movieId: "101", title: "O Poderoso Chefão", score: 4.8 },
        { movieId: "102", title: "Pulp Fiction", score: 4.7 },
        { movieId: "103", title: "Interstellar", score: 4.6 },
        { movieId: "104", title: "Batman: O Cavaleiro das Trevas", score: 4.5 },
      ];
      classics.forEach(c => {
        if (!watchedIds.has(c.movieId) && !recommendationsMap.has(c.movieId)) {
          recommendationsMap.set(c.movieId, { ...c, reasons: ["Clássico imperdível"] });
        }
      });
    }

    const finalRecommendations = Array.from(recommendationsMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(top_n));

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: finalRecommendations.map(r => ({
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
