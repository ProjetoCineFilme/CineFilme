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

    const targetUserId = Number(user_id);
    
    // 1. Load Graph
    const grafo = await carregarGrafo();
    
    // Check if user exists
    const allUsers = grafo.getUsers();
    if (!allUsers.includes(targetUserId)) {
      return NextResponse.json({ 
        error: "Usuário não encontrado na base de dados.",
        details: {
          targetUserId,
          foundUsersCount: allUsers.length,
          sampleUsers: allUsers.slice(0, 5),
          isGraphEmpty: allUsers.length === 0
        }
      }, { status: 404 });
    }

    // 2. Calculate Similarities
    const similarities: { userId: number; sim: number }[] = [];
    for (const otherUserId of allUsers) {
      if (otherUserId === targetUserId) continue;
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
    const topNRecommendations = allRecommendations.slice(0, Number(top_n));

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
