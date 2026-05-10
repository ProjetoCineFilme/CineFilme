import { describe, it, expect } from 'vitest';
import { BiGraph } from '../src/core/graph';
import { calcularSimilaridade } from '../src/core/similarity';
import { buscarCandidatos } from '../src/algorithms/bfs';
import { rankear } from '../src/algorithms/recommender';

describe('Similaridade de Cosseno', () => {
  it('Caso base: usuários com filmes em comum', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(2, 101, 5);
    const sim = calcularSimilaridade(1, 2, grafo);
    expect(sim).toBe(1);
  });

  it('Caso vazio: grafo sem arestas retorna similarity 0', () => {
    const grafo = new BiGraph();
    expect(calcularSimilaridade(1, 2, grafo)).toBe(0);
  });

  it('Caso completo: usuários com preferências variadas', () => {
    const grafo = new BiGraph();
    // User 1: A(5), B(1)
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(1, 102, 1);
    // User 2: A(1), B(5)
    grafo.adicionarAresta(2, 101, 1);
    grafo.adicionarAresta(2, 102, 5);
    const sim = calcularSimilaridade(1, 2, grafo);
    // (5*1 + 1*5) / (sqrt(25+1)*sqrt(1+25)) = 10 / 26 = 0.3846
    expect(sim).toBeCloseTo(0.38, 1);
  });
});

describe('Busca em Largura (BFS - Profundidade 2)', () => {
  it('Caso base: encontra filme do vizinho', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(2, 101, 5);
    grafo.adicionarAresta(2, 102, 5);
    const candidatos = buscarCandidatos(1, [2], grafo);
    expect(candidatos).toContain(102);
  });

  it('Caso vazio: sem vizinhos não há candidatos', () => {
    const grafo = new BiGraph();
    expect(buscarCandidatos(1, [], grafo)).toHaveLength(0);
  });

  it('Caso completo: ignora filmes já vistos pelo usuário alvo', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(2, 101, 5);
    grafo.adicionarAresta(2, 102, 5);
    const candidatos = buscarCandidatos(1, [2], grafo);
    expect(candidatos).not.toContain(101);
  });
});

describe('Ranqueamento Ponderado', () => {
  it('Caso base: calcula score para um filme', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(2, 102, 4);
    grafo.setMovieTitle(102, 'Filme A');
    const sim = new Map([[2, 0.5]]);
    const res = rankear(1, [102], sim, grafo);
    expect(res[0].score).toBe(4);
  });

  it('Caso vazio: sem candidatos retorna lista vazia', () => {
    const grafo = new BiGraph();
    expect(rankear(1, [], new Map(), grafo)).toHaveLength(0);
  });

  it('Caso completo: ordena múltiplos filmes por score', () => {
    const grafo = new BiGraph();
    grafo.adicionarAresta(2, 101, 5);
    grafo.adicionarAresta(3, 102, 2);
    grafo.setMovieTitle(101, 'Bom');
    grafo.setMovieTitle(102, 'Ruim');
    const sim = new Map([[2, 0.9], [3, 0.1]]);
    const res = rankear(1, [101, 102], sim, grafo);
    expect(res[0].movieId).toBe(101);
    expect(res[1].movieId).toBe(102);
  });
});
