import { describe, it, expect } from 'vitest';
import { BiGraph } from '../src/core/graph';
import { calcularSimilaridade } from '../src/core/similarity';
import { buscarCandidatos } from '../src/algorithms/bfs';
import { rankear } from '../src/algorithms/recommender';

describe('Algoritmos de Recomendação', () => {
  const setupMockGraph = () => {
    const grafo = new BiGraph();
    // User 1: Movie A(5), Movie B(4)
    grafo.adicionarAresta(1, 101, 5);
    grafo.adicionarAresta(1, 102, 4);
    
    // User 2: Movie A(5), Movie B(5), Movie C(2)
    grafo.adicionarAresta(2, 101, 5);
    grafo.adicionarAresta(2, 102, 5);
    grafo.adicionarAresta(2, 103, 2);

    // User 3: Movie B(1), Movie C(5)
    grafo.adicionarAresta(3, 102, 1);
    grafo.adicionarAresta(3, 103, 5);

    return grafo;
  };

  it('Similaridade: Caso base com resultado esperado', () => {
    const grafo = setupMockGraph();
    const sim12 = calcularSimilaridade(1, 2, grafo);
    expect(sim12).toBeGreaterThan(0.9); // Deviam ser muito similares
    
    const sim13 = calcularSimilaridade(1, 3, grafo);
    expect(sim13).toBeLessThan(sim12);
  });

  it('BFS: Encontra candidatos corretamente (profundidade 2)', () => {
    const grafo = setupMockGraph();
    // Vizinho de 1 é o 2. O 2 assistiu o filme 103 que o 1 não assistiu.
    const candidatos = buscarCandidatos(1, [2], grafo);
    expect(candidatos).toContain(103);
    expect(candidatos).not.toContain(101); // Já assistido
  });

  it('Ranking: Ordena por score ponderado', () => {
    const grafo = setupMockGraph();
    grafo.setMovieTitle(103, 'Interstellar');
    
    const neighborSim = new Map([[2, 0.9], [3, 0.1]]);
    const candidates = [103];
    
    const recs = rankear(1, candidates, neighborSim, grafo);
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe('Interstellar');
    // Score esperado: (0.9*2 + 0.1*5) / (0.9 + 0.1) = (1.8 + 0.5) / 1.0 = 2.3
    expect(recs[0].score).toBeCloseTo(2.3);
  });

  it('Caso vazio: retorno coerente', () => {
    const grafo = new BiGraph();
    expect(calcularSimilaridade(1, 2, grafo)).toBe(0);
    expect(buscarCandidatos(1, [], grafo)).toHaveLength(0);
    expect(rankear(1, [], new Map(), grafo)).toHaveLength(0);
  });
});
