# Constellation — Personal RAG

A self-hosted retrieval-augmented generation app: upload documents, chat over them with
citation-aware retrieval, explore a similarity graph of your library, and measure
retrieval quality with a built-in evaluation dashboard.

- **Backend**: FastAPI, MongoDB, ChromaDB, Ollama (local embeddings + generation),
  Cohere rerank
- **Frontend**: React 19 + Vite + Tailwind, React Router

## Features

- **Auth** — JWT-based register/login.
- **Ingestion** — upload `.pdf`, `.md`, `.csv`, `.txt`; parsed, chunked
  (`RecursiveCharacterTextSplitter`, 1000/200), embedded with `embeddinggemma:300m`,
  and stored in Chroma per-user.
- **Chat** — query rewriting against chat history, vector similarity search scoped to
  selected documents, Cohere rerank, streamed generation via Ollama, adjustable
  relevance threshold, persisted chat sessions.
- **Knowledge graph** — a force-free similarity map of a user's documents, edges
  weighted by cosine similarity between document embedding centroids.
- **Evaluation dashboard** *(new)* — auto-generates a golden question set from a
  user's own ingested chunks (LLM-authored, one question per sampled chunk), runs it
  through the real retrieval pipeline, and reports hit rate, MRR, precision@k, and
  recall@k, with per-query breakdown and run history.

## Retrieval benchmark

The eval pipeline was run against two real corpora already indexed in this repo's
Chroma store (not synthetic data) via `POST /eval/generate` → `POST /eval/run`, using
the production `retrieve()` code path (query rewrite → vector search → Cohere rerank)
at `k=5`.

| Corpus | Documents | Chunks | Golden questions | Hit Rate | MRR | Precision@5 | Recall@5 |
|---|---|---|---|---|---|---|---|
| Technical books (topically distinct) | 2 (*book_pdf.pdf*, 523pp; *Writing an Interpreter in Go*, 206pp) | 2,635 | 30 | **100%** | **1.00** | 98.7% | 100% |
| Disambiguation set (adversarial) | 4, incl. **2 files sharing the same filename** (`7ac587`) | 53 | 12 | **83.3%** | **0.83** | 81.7% | 83.3% |

Takeaways:
- On topically distinct documents, the rewrite → embed → rerank pipeline retrieves the
  correct source document essentially every time — MRR of 1.00 means the right answer
  is (almost) always ranked first, not just present somewhere in the top 5.
- The harder set is a deliberate stress test: two unrelated PDFs share the exact same
  filename, so the system can't lean on filenames and has to disambiguate on embedded
  content alone. It still resolves ~5 of 6 queries correctly — the two misses were
  both underspecified questions ("What is the source of manuals?") with genuine
  cross-document ambiguity, not retrieval failures.
- Every number above was produced by the shipped `/eval` pipeline itself, so the
  dashboard's "aggregate metrics" and this table are the same code path.

Re-run it yourself from the `/eval` page: generate a golden set for your own documents,
hit run, and the same hit-rate/MRR/precision/recall numbers populate live.

## Architecture

```
Frontend/          React app (Vite)
  src/api.js          fetch client for every backend endpoint
  src/context/         AuthContext (token/user, localStorage-backed)
  src/components/      ConstellationGraph, AuthScreen, Sidebar, DocumentPanel, ChatView
  src/pages/            Workspace (chat + docs + graph), EvalDashboard

Backend/
  main.py              FastAPI routes
  config.py             pydantic-settings config (no hardcoded paths/secrets)
  utils/
    clients.py           singleton Chroma/embedding/Cohere/Ollama clients
    auth.py               JWT auth
    database.py            Mongo access (users, documents, chats, eval_questions, eval_runs)
    parser.py               per-file-type document loaders
    ingestion.py              chunk + embed + store
    retrieval.py               rewrite -> vector search -> rerank -> grounded prompt
    knowledge_graph.py          embedding-centroid similarity graph
    evaluation.py                golden-set generation + retrieval metrics
  tests/
    test_evaluation.py          unit tests for the metric functions
```

## Running locally

1. Ollama running locally with `embeddinggemma:300m`, and whatever models you set for
   `GENERATION_MODEL` / `OLLAMA_REWRITE_MODEL` (defaults: `llama3.2:1b`) pulled.
2. MongoDB reachable at `MONGODB_URL`.
3. Copy `.env.example` to `.env` and fill in `JWT_SECRET_KEY`, `COHERE_KEY`, etc.

```bash
# backend
cd Backend && pip install -e ".[test]"
uvicorn Backend.main:app --reload

# frontend
cd Frontend && npm install && npm run dev
```

Backend tests: `python -m pytest Backend/tests/`

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/register`, `/login` | auth |
| GET | `/me` | current user |
| POST | `/upload` | ingest a document |
| GET | `/all-docs` | list a user's documents |
| GET | `/knowledge-graph` | similarity graph |
| POST | `/query` | streamed, retrieval-grounded chat |
| POST/GET/PATCH/DELETE | `/chats` | chat session CRUD |
| POST | `/eval/generate` | build a golden question set from ingested chunks |
| GET | `/eval/questions` | list the golden set |
| POST | `/eval/run` | run retrieval eval, returns aggregate + per-query metrics |
| GET | `/eval/runs`, `/eval/runs/{id}` | run history / detail |
