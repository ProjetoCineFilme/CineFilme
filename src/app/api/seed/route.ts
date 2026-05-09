import { NextResponse } from 'next/server';
import { collection, getDocs, addDoc, query, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export async function POST() {
  try {
    const moviesRef = collection(db, "movies");
    const ratingsRef = collection(db, "ratings");

    const movieCheck = await getDocs(query(moviesRef, limit(1)));
    if (!movieCheck.empty) {
      return NextResponse.json({ message: "O banco já contém dados. Nenhuma ação necessária." });
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

    return NextResponse.json({ message: "Banco de dados populado com sucesso! Agora você pode testar os IDs sugeridos." });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Erro ao popular banco de dados." }, { status: 500 });
  }
}
