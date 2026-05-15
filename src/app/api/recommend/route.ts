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

    // 2. Coletar candidatos de outros usuários (FILTRAGEM COLABORATIVA AGRESSIVA)
    const candidates = new Map<string, { movieId: string, title: string, score: number, isGenreMatch: boolean, contributors: number }>();

    for (const otherUserId of allUsers) {
      const sOtherId = String(otherUserId);
      if (sOtherId.toLowerCase() === targetIdStr) continue;
      
      const otherRatings = grafo.consultarAdjacencia(otherUserId, 'user');
      const sim = calcularSimilaridade(realTargetId, otherUserId, grafo);
      
      // Se não tem similaridade mínima, ignora (evita ruído)
      if (sim <= 0) continue;

      for (const r of otherRatings) {
        const mid = String(r.toId);
        if (watchedIds.has(mid)) continue;

        const genre = normalize(grafo.getMovieGenre(mid));
        const genreMatch = favoriteGenres.has(genre);
        
        // CÁLCULO DE SCORE POR ACUMULAÇÃO (VOTAÇÃO PONDERADA):
        // Cada usuário contribui com (Nota dele * Sua similaridade com ele)
        // Bônus se for o gênero que você gosta.
        const contribution = (r.weight * sim * 1000) * (genreMatch ? 1.5 : 1.0);

        if (!candidates.has(mid)) {
          candidates.set(mid, { 
            movieId: mid, 
            title: grafo.getMovieTitle(mid), 
            genre: grafo.getMovieGenre(mid),
            posterPath: grafo.getMoviePoster(mid),
            score: contribution,
            isGenreMatch: genreMatch,
            contributors: 1
          });
        } else {
          const current = candidates.get(mid)!;
          current.score += contribution;
          current.contributors += 1;
        }
      }
    }

    // 2.1 Bônus de Texto (Heurística de Título para Franquias)
    // Se o usuário viu "Avatar", outros filmes com "Avatar" no nome ganham bônus
    const watchedTitles = userRatings.map(r => grafo.getMovieTitle(r.toId).toLowerCase());
    candidates.forEach((cand, mid) => {
      const candTitle = cand.title.toLowerCase();
      for (const watchedTitle of watchedTitles) {
        // Se o nome contém uma parte importante comum (mais de 4 letras)
        if (watchedTitle.length > 4 && candTitle.includes(watchedTitle) || watchedTitle.includes(candTitle)) {
          cand.score *= 2.5; // Bônus de franquia/título similar
        }
      }
    });

    // 3. Ordenação Final
    let topNRecommendations = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score);

    // FALLBACK: Se não houver recomendações personalizadas ou poucas, 
    // sugerir os filmes mais populares do sistema que o usuário ainda não viu.
    if (topNRecommendations.length < Number(top_n)) {
      const allMovies = grafo.getMovies();
      const movieStats = new Map<string, { count: number, ratingSum: number }>();
      
      // Contar avaliações globais
      allUsers.forEach(u => {
        grafo.consultarAdjacencia(u, 'user').forEach(r => {
          const mid = String(r.toId);
          if (!movieStats.has(mid)) movieStats.set(mid, { count: 0, ratingSum: 0 });
          const stats = movieStats.get(mid)!;
          stats.count++;
          stats.ratingSum += r.weight;
        });
      });

      const popularCandidates = allMovies
        .filter(mid => !watchedIds.has(String(mid))) // Não viu ainda
        .map(mid => {
          const sMid = String(mid);
          const stats = movieStats.get(sMid) || { count: 0, ratingSum: 0 };
          return {
            movieId: sMid,
            title: grafo.getMovieTitle(sMid) || "Filme Desconhecido",
            genre: grafo.getMovieGenre(sMid) || "Geral",
            posterPath: grafo.getMoviePoster(sMid),
            // Score de popularidade: (Nota média * log(quantidade))
            score: (stats.count > 0 ? (stats.ratingSum / stats.count) * Math.log10(stats.count + 1) : 0)
          };
        })
        .filter(m => m.title !== "Filme Desconhecido")
        .sort((a, b) => b.score - a.score);

      // Adicionar populares que ainda não estão nos candidatos
      for (const p of popularCandidates) {
        if (topNRecommendations.length >= Number(top_n)) break;
        if (!topNRecommendations.find(r => r.movieId === p.movieId)) {
          topNRecommendations.push({
            ...p,
            isGenreMatch: favoriteGenres.has(normalize(p.genre))
          });
        }
      }
    }

    // Corte final
    topNRecommendations = topNRecommendations.slice(0, Number(top_n));

    return NextResponse.json({
      user_id: targetUserId,
      recommendations: topNRecommendations.map(r => {
        // Normalização visual para 4.0 - 5.0 estrelas
        let finalDisplayScore = 3.0;
        if (r.isGenreMatch) {
          finalDisplayScore = 4.7 + (Math.random() * 0.2);
        } else {
          finalDisplayScore = 4.0 + (Math.random() * 0.7);
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
