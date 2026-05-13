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

    // Se houver apenas 1 usuário ou nenhum, retornamos os filmes mais populares como recomendação básica
    if (allUsers.length <= 1) {
       const moviesRepo = grafo.getMovies();
       const trending = moviesRepo.slice(0, Number(top_n)).map(mid => ({
         title: grafo.getMovieTitle(mid),
         score: 5.0
       }));

       return NextResponse.json({
         user_id: targetUserId,
         is_fallback: true,
         message: "Aguardando mais usuários para recomendações personalizadas. Aqui estão os destaques!",
         recommendations: trending
       });
    }
    
    // Se o usuário alvo não tem avaliações mas outros têm
    if (!allUsers.some(u => String(u) === String(targetUserId))) {
      const moviesRepo = grafo.getMovies();
      return NextResponse.json({
         user_id: targetUserId,
         is_new_user: true,
         message: "Avalie mais filmes para receber recomendações personalizadas!",
         recommendations: moviesRepo.slice(0, Number(top_n)).map(mid => ({ 
           title: grafo.getMovieTitle(mid), 
           score: 0 
         }))
      });
    }

    // 2. Calculate Similarities
    const similarities: { userId: any; sim: number }[] = [];
    for (const otherUserId of allUsers) {
      if (String(otherUserId) === String(targetUserId)) continue;
      const sim = calcularSimilaridade(targetUserId, otherUserId, grafo);
      if (sim > 0) {
        similarities.push({ userId: otherUserId, sim });
      }
    }

    // 3. Select K neighbors
    const topKNeighbors = similarities
      .sort((a, b) => b.sim - a.sim)
      .slice(0, Number(k));

    const neighborMap = new Map(topKNeighbors.map(n => [n.userId, n.sim]));
    const neighborIds = topKNeighbors.map(n => n.userId);

    // 4. BFS Candidates
    const candidates = buscarCandidatos(targetUserId, neighborIds, grafo);

    // 5. Rank Candidates
    const allRecommendations = rankear(targetUserId, candidates, neighborMap, grafo);

    // 6. Return Top N
    let topNRecommendations = allRecommendations.slice(0, Number(top_n));

    // Fallback logic SUPREMO:
    // Se não houver recomendações personalizadas (usuário novo ou sem vizinhos), 
    // sugerimos filmes que ele ainda não viu, priorizando os de gêneros que ele já avaliou.
    if (topNRecommendations.length < Number(top_n)) {
      const normalize = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "geral";
      
      const userRatings = grafo.consultarAdjacencia(targetUserId, 'user');
      const watchedIds = new Set(userRatings.map(r => String(r.toId)));
      const myGenres = new Set(userRatings.map(r => normalize(grafo.getMovieGenre(r.toId))));
      
      let allMovies = grafo.getMovies();
      
      const additional = allMovies
        .filter(mid => {
          const sMid = String(mid);
          // Não assistido e não está na lista atual de recomendações
          return !watchedIds.has(sMid) && !topNRecommendations.some(r => String(r.movieId) === sMid);
        })
        .sort((a, b) => {
          const genreA = normalize(grafo.getMovieGenre(a));
          const genreB = normalize(grafo.getMovieGenre(b));
          
          // Pontuação de similaridade de gênero
          const scoreA = myGenres.has(genreA) ? 1000 : 0;
          const scoreB = myGenres.has(genreB) ? 1000 : 0;
          
          // Popularidade global (quem tem mais avaliações)
          const popA = grafo.consultarAdjacencia(a, 'movie').length;
          const popB = grafo.consultarAdjacencia(b, 'movie').length;
          
          // Se for um filme "Standard", ganha um bônus de visibilidade no fallback
          const isStdA = STANDARD_MOVIE_IDS.includes(Number(a)) ? 50 : 0;
          const isStdB = STANDARD_MOVIE_IDS.includes(Number(b)) ? 50 : 0;
          
          return (scoreB + popB + isStdB) - (scoreA + popA + isStdA) || Math.random() - 0.5;
        })
        .slice(0, Math.max(0, Number(top_n) - topNRecommendations.length))
        .map(mid => ({
          movieId: mid,
          title: grafo.getMovieTitle(mid),
          score: 3.5 + (Math.random() * 0.5) 
        }));
      
      topNRecommendations = [...topNRecommendations, ...additional];
    }

    // Baseline absoluta: se a base de filmes estiver estranhamente vazia ou o usuário viu TUDO 
    // mas precisamos retornar algo (ex: top_n o obriga)
    if (topNRecommendations.length === 0) {
       // Tenta pegar os clássicos que definimos no início
       const classics = [
         { movieId: "101", title: "O Poderoso Chefão", score: 4.8 },
         { movieId: "102", title: "Pulp Fiction", score: 4.7 },
         { movieId: "103", title: "Interstellar", score: 4.6 },
         { movieId: "104", title: "Batman: O Cavaleiro das Trevas", score: 4.5 },
         { movieId: "105", title: "Gente Grande", score: 4.0 },
         { movieId: "106", title: "Esposa de Mentirinha", score: 4.0 },
       ];
       topNRecommendations = classics.slice(0, Number(top_n));
    }

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: topNRecommendations.map(r => ({
        title: r.title,
        score: Number(Number(r.score).toFixed(2))
      }))
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ error: "Erro interno no servidor de recomendação." }, { status: 500 });
  }
}
