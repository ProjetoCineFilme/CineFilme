# CineFilme — Sistema de Recomendação de Filmes baseado em Grafos

Este projeto é um MVP de um sistema de recomendação que utiliza filtragem colaborativa baseada em usuários (User-User Collaborative Filtering) implementada através de uma estrutura de grafo bipartido.

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure o Firebase:
   - Copie o arquivo `.env.local.example` para `.env.local`
   - Preencha as credenciais do seu projeto Firebase ( Firestore habilitado ).
   - Certifique-se de ter as coleções `ratings` e `movies` no seu banco.

3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse: `http://localhost:3000`

## Algoritmos
- **Similaridade de Cosseno**: Mede a proximidade entre perfis de usuários.
- **BFS (Breadth-First Search)**: Explora o grafo para encontrar filmes candidatos.
- **Ranking Ponderado**: Calcula a nota estimada baseada na opinião de vizinhos similares.

## Tecnologias
- Framework: Express + React (Vite)
- Banco de dados: Firebase Firestore
- Estilização: Tailwind CSS
- Animações: Motion
- Testes: Vitest
