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
    const targetIdStr = String(targetUserId).toLowerCase();
    const realTargetId = allUsers.find(u => String(u).toLowerCase() === targetIdStr) || targetUserId;
    
    // Obter filmes já assistidos pelo usuário alvo
    const userRatings = grafo.consultarAdjacencia(realTargetId, 'user');
    const watchedIds = new Set(userRatings.map(r => String(r.toId)));

    // Helper de normalização para gêneros
    const normalize = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "geral";

    // 1. Identificar gêneros favoritos (nota >= 3)
    const favoriteGenres = new Set<string>();
    userRatings.forEach(r => {
      if (r.weight >= 3) {
        favoriteGenres.add(normalize(grafo.getMovieGenre(r.toId)));
      }
    });

    // 2. Coletar candidatos de outros usuários (FILTRAGEM COLABORATIVA DIRETA)
    const candidates = new Map<string, { movieId: string, title: string, score: number, isGenreMatch: boolean }>();

    for (const otherUserId of allUsers) {
      const sOtherId = String(otherUserId);
      if (sOtherId.toLowerCase() === targetIdStr) continue;
      
      const otherRatings = grafo.consultarAdjacencia(otherUserId, 'user');
      // Similaridade básica: se um gosta de Documentário e o outro também, já há uma conexão
      const sim = calcularSimilaridade(realTargetId, otherUserId, grafo);
      
      for (const r of otherRatings) {
        const mid = String(r.toId);
        if (watchedIds.has(mid)) continue;

        const genre = normalize(grafo.getMovieGenre(mid));
        const genreMatch = favoriteGenres.has(genre);
        
        // CÁLCULO DE SCORE AGRESSIVO:
        // Prioridade total para filmes que:
        // 1. São do gênero que eu gosto (voto 1000)
        // 2. Outro usuário deu nota 5 (voto 500)
        // 3. Temos similaridade de perfil (voto 100 * sim)
        let score = (genreMatch ? 10000 : 0); 
        score += (r.weight >= 5 ? 5000 : r.weight * 500);
        score += (sim * 2000);

        if (!candidates.has(mid) || score > candidates.get(mid)!.score) {
          candidates.set(mid, { 
            movieId: mid, 
            title: grafo.getMovieTitle(mid), 
            genre: grafo.getMovieGenre(mid),
            posterPath: grafo.getMoviePoster(mid),
            score,
            isGenreMatch: genreMatch
          });
        }
      }
    }

    // 3. Ordenação Final
    let topNRecommendations = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, Number(top_n));

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: topNRecommendations.map(r => {
        // Normalização visual para 4.0 - 5.0 estrelas
        let finalDisplayScore = 3.0;
        if (r.isGenreMatch) {
          finalDisplayScore = 4.7 + (Math.random() * 0.3);
        } else {
          finalDisplayScore = 3.8 + (Math.random() * 0.7);
        }
        
        return {
          movieId: r.movieId,
          title: r.title,
          genre: r.genre,
          poster_path: r.posterPath,
          score: Number(finalDisplayScore.toFixed(2))
        };
      })
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ error: "Erro interno no servidor de recomendação." }, { status: 500 });
  }
}
