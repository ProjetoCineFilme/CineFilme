import { describe, it, expect } from 'vitest';
import { BiGraph } from '../src/core/graph';

describe('BiGraph', () => {
  it('Caso base: deve adicionar vértices e arestas corretamente', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(1, 101, 5);
    
    const users = grafo.getUsers();
    const adj = grafo.consultarAdjacencia(1, 'user');
    
    expect(users).toContain(1);
    expect(adj).toHaveLength(1);
    expect(adj[0].toId).toBe(101);
    expect(adj[0].weight).toBe(5);
  });

  it('Caso vazio: consulta em grafo vazio retorna lista vazia', () => {
    const grafo = new BiGraph();
    const adj = grafo.consultarAdjacencia(999, 'user');
    expect(adj).toHaveLength(0);
  });

  it('Caso completo: múltiplos usuários e filmes', () => {
    const grafo = new BiGraph();
    // User 1 connected to 101, 102
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(1, 102, 3);
    // User 2 connected to 101, 103
    grafo.adicionarAresta(2, 101, 4);
    grafo.adicionarAresta(2, 103, 1);

    expect(grafo.getUsers()).toHaveLength(2);
    expect(grafo.getMovies()).toHaveLength(3);
    expect(grafo.consultarAdjacencia(101, 'movie')).toHaveLength(2);
  });
});
