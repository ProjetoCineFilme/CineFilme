import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { collection, getDocs, addDoc, query, limit } from "firebase/firestore";
import { db } from "./src/lib/firebase";
import { carregarGrafo } from "./src/io/loader";
import { calcularSimilaridade } from "./src/core/similarity";
import { buscarCandidatos } from "./src/algorithms/bfs";
import { rankear } from "./src/algorithms/recommender";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Seed
  app.post("/api/seed", async (req, res) => {
    try {
      const moviesRef = collection(db, "movies");
      const ratingsRef = collection(db, "ratings");

      const movieCheck = await getDocs(query(moviesRef, limit(1)));
      if (!movieCheck.empty) {
        return res.json({ message: "O banco já contém dados. Nenhuma ação necessária." });
      }

      // Sample Data - Movies
      const movies = [
        { movie_id: 101, title: "O Poderoso Chefão" },
        { movie_id: 102, title: "Pulp Fiction" },
        { movie_id: 103, title: "Interstellar" },
        { movie_id: 104, title: "Batman: O Cavaleiro das Trevas" },
        { movie_id: 105, title: "Clube da Luta" },
        { movie_id: 106, title: "Matrix" },
        { movie_id: 107, title: "Parasita" },
        { movie_id: 108, title: "Cidade de Deus" },
      ];

      for (const m of movies) {
        await addDoc(moviesRef, m);
      }

      // Sample Data - Ratings (User, Movie, Rating)
      const ratings = [
        { user_id: 1, movie_id: 101, rating: 5 }, { user_id: 1, movie_id: 102, rating: 4 }, { user_id: 1, movie_id: 103, rating: 1 }, { user_id: 1, movie_id: 105, rating: 2 },
        { user_id: 2, movie_id: 101, rating: 5 }, { user_id: 2, movie_id: 102, rating: 5 }, { user_id: 2, movie_id: 104, rating: 2 }, { user_id: 2, movie_id: 103, rating: 1 },
        { user_id: 3, movie_id: 103, rating: 5 }, { user_id: 3, movie_id: 104, rating: 4 }, { user_id: 3, movie_id: 105, rating: 1 }, { user_id: 3, movie_id: 101, rating: 2 },
        { user_id: 4, movie_id: 101, rating: 1 }, { user_id: 4, movie_id: 105, rating: 5 }, { user_id: 4, movie_id: 106, rating: 4 }, { user_id: 4, movie_id: 102, rating: 1 },
        { user_id: 5, movie_id: 102, rating: 4 }, { user_id: 5, movie_id: 103, rating: 2 }, { user_id: 5, movie_id: 107, rating: 5 }, { user_id: 5, movie_id: 108, rating: 4 },
      ];

      for (const r of ratings) {
        await addDoc(ratingsRef, r);
      }

      res.json({ message: "Banco de dados populado com sucesso! Agora você pode testar os IDs sugeridos." });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Erro ao popular banco de dados." });
    }
  });

  // API Route: Recommend
  app.post("/api/recommend", async (req, res) => {
    try {
      const { user_id, top_n = 10, k = 5 } = req.body;

      if (user_id === undefined) {
        return res.status(400).json({ error: "user_id is required" });
      }

      const targetUserId = Number(user_id);
      
      // 1. Load Graph
      const grafo = await carregarGrafo();
      
      // Check if user exists
      const allUsers = grafo.getUsers();
      if (!allUsers.includes(targetUserId)) {
        return res.status(404).json({ error: "User not found in graph" });
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

      res.json({
        user_id: targetUserId,
        recommendations: topNRecommendations.map(r => ({
          title: r.title,
          score: r.score
        }))
      });
    } catch (error) {
      console.error("Recommendation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
