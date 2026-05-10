# CineFilme
Sistema de recomendação de filmes inteligente que utiliza algoritmos de grafos e filtragem colaborativa para sugerir novos títulos baseados nas preferências do usuário.
A plataforma conecta cinéfilos, permitindo avaliações e descoberta de novos conteúdos através de similaridade matemática.

**Site:** [https://cine-filme.vercel.app](https://cine-filme.vercel.app)

## Estrutura do Projeto
- `src/core/`: Implementação do Grafo Bipartido e Similaridade de Cosseno.
- `src/algorithms/`: Algoritmos de busca (BFS) e ranqueamento (Weighted Score).
- `src/io/`: Módulo de carregamento e interface de dados.
- `src/app/api/`: Rotas de backend para processamento dos algoritmos.
- `tests/`: Suíte de testes unitários.

## Algoritmos Utilizados
1. **BiGraph**: Modelagem de dados entre usuários e itens.
2. **Cosine Similarity**: Cálculo de proximidade entre vetores de avaliação.
3. **BFS (Depth 2)**: Exploração de vizinhança para expansão de candidatos.
4. **Weighted Ranking**: Predição de nota baseada na similaridade dos vizinhos.

## Como rodar localmente
1. Instale as dependências: `npm install`
2. Configure o `.env` com as chaves do Firebase.
3. Execute: `npm run dev`
