/**
 * BiGraph class to represent a bipartite graph between Users and Movies.
 */
export type NodeType = 'user' | 'movie';
export type NodeId = string | number;

export interface Edge {
  toId: NodeId;
  weight: number;
}

export class BiGraph {
  private userNodes: Map<string, Edge[]> = new Map();
  private movieNodes: Map<string, Edge[]> = new Map();
  private movieTitles: Map<string, string> = new Map();
  private movieGenres: Map<string, string> = new Map();

  adicionarVertice(id: NodeId, tipo: NodeType) {
    const sId = String(id);
    if (tipo === 'user') {
      if (!this.userNodes.has(sId)) this.userNodes.set(sId, []);
    } else {
      if (!this.movieNodes.has(sId)) this.movieNodes.set(sId, []);
    }
  }

  adicionarAresta(userId: NodeId, movieId: NodeId, rating: number) {
    const sUserId = String(userId);
    const sMovieId = String(movieId);

    this.adicionarVertice(sUserId, 'user');
    this.adicionarVertice(sMovieId, 'movie');

    const userEdges = this.userNodes.get(sUserId)!;
    const existingUserEdge = userEdges.find(e => String(e.toId) === sMovieId);
    if (existingUserEdge) {
      existingUserEdge.weight = rating;
    } else {
      userEdges.push({ toId: sMovieId, weight: rating });
    }

    const movieEdges = this.movieNodes.get(sMovieId)!;
    const existingMovieEdge = movieEdges.find(e => String(e.toId) === sUserId);
    if (existingMovieEdge) {
      existingMovieEdge.weight = rating;
    } else {
      movieEdges.push({ toId: sUserId, weight: rating });
    }
  }

  setMovieTitle(movieId: NodeId, title: string) {
    this.movieTitles.set(String(movieId), title);
  }

  getMovieTitle(movieId: NodeId): string {
    return this.movieTitles.get(String(movieId)) || `Filme #${movieId}`;
  }

  setMovieGenre(movieId: NodeId, genre: string) {
    this.movieGenres.set(String(movieId), genre);
  }

  getMovieGenre(movieId: NodeId): string {
    return this.movieGenres.get(String(movieId)) || "Sem Gênero";
  }

  consultarAdjacencia(id: NodeId, tipo: NodeType): Edge[] {
    const nodes = tipo === 'user' ? this.userNodes : this.movieNodes;
    return nodes.get(String(id)) || [];
  }

  getUsers(): NodeId[] {
    return Array.from(this.userNodes.keys());
  }

  getMovies(): NodeId[] {
    return Array.from(this.movieNodes.keys());
  }
}
