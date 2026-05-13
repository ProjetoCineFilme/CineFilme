import { NextResponse } from 'next/server';
import { carregarGrafo } from '../../../io/loader';
import { calcularSimilaridade } from '../../../core/similarity';
import { buscarCandidatos } from '../../../algorithms/bfs';
import { rankear } from '../../../algorithms/recommender';

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

    // Fallback logic: if no personalized recommendations, suggest movies from same categories user liked
    if (topNRecommendations.length < Number(top_n)) {
      const normalize = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "geral";
      
      const userRatings = grafo.consultarAdjacencia(targetUserId, 'user');
      const watchedIds = new Set(userRatings.map(r => String(r.toId)));
      const myGenres = new Set(userRatings.map(r => normalize(grafo.getMovieGenre(r.toId))));
      
      const allMovies = grafo.getMovies();
      const additional = allMovies
        .filter(mid => {
          const sMid = String(mid);
          const genre = normalize(grafo.getMovieGenre(mid));
          // Not watched, and matches a liked genre (or just any if we need more)
          return !watchedIds.has(sMid) && !topNRecommendations.some(r => String(r.movieId) === sMid) && (myGenres.has(genre) || myGenres.size === 0);
        })
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, Number(top_n) - topNRecommendations.length)
        .map(mid => ({
          movieId: mid,
          title: grafo.getMovieTitle(mid),
          score: 1.0 // Simple fallback score
        }));
      
      topNRecommendations = [...topNRecommendations, ...additional];
    }

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: topNRecommendations.map(r => ({
        title: r.title,
        score: r.score
      }))
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ error: "Erro interno no servidor de recomendação." }, { status: 500 });
  }
}
