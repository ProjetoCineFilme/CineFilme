/**
 * BiGraph class to represent a bipartite graph between Users and Movies.
 */
export type NodeType = 'user' | 'movie';

export interface Edge {
  toId: number;
  weight: number;
}

export class BiGraph {
  private userNodes: Map<number, Edge[]> = new Map();
  private movieNodes: Map<number, Edge[]> = new Map();
  private movieTitles: Map<number, string> = new Map();

  adicionarVertice(id: number, tipo: NodeType) {
    if (tipo === 'user') {
      if (!this.userNodes.has(id)) this.userNodes.set(id, []);
    } else {
      if (!this.movieNodes.has(id)) this.movieNodes.set(id, []);
    }
  }

  adicionarAresta(userId: number, movieId: number, rating: number) {
    this.adicionarVertice(userId, 'user');
    this.adicionarVertice(movieId, 'movie');

    const userEdges = this.userNodes.get(userId)!;
    const existingUserEdge = userEdges.find(e => e.toId === movieId);
    if (existingUserEdge) {
      existingUserEdge.weight = rating;
    } else {
      userEdges.push({ toId: movieId, weight: rating });
    }

    const movieEdges = this.movieNodes.get(movieId)!;
    const existingMovieEdge = movieEdges.find(e => e.toId === userId);
    if (existingMovieEdge) {
      existingMovieEdge.weight = rating;
    } else {
      movieEdges.push({ toId: userId, weight: rating });
    }
  }

  setMovieTitle(movieId: number, title: string) {
    this.movieTitles.set(movieId, title);
  }

  getMovieTitle(movieId: number): string {
    return this.movieTitles.get(movieId) || `Movie ${movieId}`;
  }

  consultarAdjacencia(id: number, tipo: NodeType): Edge[] {
    const nodes = tipo === 'user' ? this.userNodes : this.movieNodes;
    return nodes.get(id) || [];
  }

  getUsers(): number[] {
    return Array.from(this.userNodes.keys());
  }

  getMovies(): number[] {
    return Array.from(this.movieNodes.keys());
  }
}
