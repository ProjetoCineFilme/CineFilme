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
  private userNodes: Map<NodeId, Edge[]> = new Map();
  private movieNodes: Map<NodeId, Edge[]> = new Map();
  private movieTitles: Map<NodeId, string> = new Map();

  adicionarVertice(id: NodeId, tipo: NodeType) {
    if (tipo === 'user') {
      if (!this.userNodes.has(id)) this.userNodes.set(id, []);
    } else {
      if (!this.movieNodes.has(id)) this.movieNodes.set(id, []);
    }
  }

  adicionarAresta(userId: NodeId, movieId: NodeId, rating: number) {
    this.adicionarVertice(userId, 'user');
    this.adicionarVertice(movieId, 'movie');

    const userEdges = this.userNodes.get(userId)!;
    const existingUserEdge = userEdges.find(e => String(e.toId) === String(movieId));
    if (existingUserEdge) {
      existingUserEdge.weight = rating;
    } else {
      userEdges.push({ toId: movieId, weight: rating });
    }

    const movieEdges = this.movieNodes.get(movieId)!;
    const existingMovieEdge = movieEdges.find(e => String(e.toId) === String(userId));
    if (existingMovieEdge) {
      existingMovieEdge.weight = rating;
    } else {
      movieEdges.push({ toId: userId, weight: rating });
    }
  }

  setMovieTitle(movieId: NodeId, title: string) {
    this.movieTitles.set(movieId, title);
  }

  getMovieTitle(movieId: NodeId): string {
    return this.movieTitles.get(movieId) || `Filme #${movieId}`;
  }

  consultarAdjacencia(id: NodeId, tipo: NodeType): Edge[] {
    const nodes = tipo === 'user' ? this.userNodes : this.movieNodes;
    return nodes.get(id) || [];
  }

  getUsers(): NodeId[] {
    return Array.from(this.userNodes.keys());
  }

  getMovies(): NodeId[] {
    return Array.from(this.movieNodes.keys());
  }
}
