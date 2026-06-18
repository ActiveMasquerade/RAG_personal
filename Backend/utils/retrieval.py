from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_chroma import Chroma
import cohere
import asyncio
import os

OLLAMA_REWRITE_MODEL = os.getenv("OLLAMA_REWRITE_MODEL", "llama3.2:1b")


def _message_text(message) -> str:
    if hasattr(message, "model_dump"):
        message = message.model_dump()
    role = str(message.get("role", "")).strip()
    content = str(message.get("content", "")).strip()
    return f"{role}: {content}" if role and content else content


def _rewrite_with_ollama(prompt: str) -> str:
    llm = OllamaLLM(model=OLLAMA_REWRITE_MODEL)
    return llm.invoke(prompt)


async def retrieve(docs, query, user_id: str, chat_history: list | None = None):
    cohere_key = os.environ["COHERE_KEY"]
    cohere_client = cohere.ClientV2(api_key=cohere_key)
    k = 5
    embedding_model = OllamaEmbeddings(model="embeddinggemma:300m")
    rewritten_query = await query_rewriter(chat_history or [], query)
    vector_store = Chroma(
        collection_name = "local_rag",
        persist_directory="/home/kaniss/RAG_personal/Backend/chromadb",
        embedding_function=embedding_model
    )
    chunks = vector_store.similarity_search(query=rewritten_query,
                                            k= 20 ,
                                            filter={
                                                "$and": [
                                                    {
                                                        "document_id": {
                                                            "$in": docs
                                                        }
                                                    },
                                                    {
                                                        "user_id": user_id
                                                    }
                                                ]
                                            })
    rerank_input_chunks = [chunk.page_content for chunk in chunks]
    if len(chunks)==0:
        return "", [],[]

    refined_chunks_index = cohere_client.rerank(
            model="rerank-v4.0-fast",
            query=rewritten_query,
            documents=rerank_input_chunks,
            top_n = k,

    )
    refined_chunks = [chunks[refined.index] for refined in refined_chunks_index.results]
    context = '\n\n'.join(chunk.page_content for chunk in refined_chunks)

    final_query = f"""answer the question below with the given context:
    question: {rewritten_query}

    context:{context}

    """
    grounding: list[dict] = []
    for index,chunk in enumerate(refined_chunks):
        ground_atom = {"id": index,
                       "chunk_id": chunk.metadata.get("chunk_id"),
                       "document_id": chunk.metadata.get("document_id"),
                        "saved_file_name": chunk.metadata.get("saved_file_name"),
                         "page_number" : chunk.metadata.get("page"),
                          "original_file_name":chunk.metadata.get("original_file_name") }

        grounding.append(ground_atom)
    return final_query, refined_chunks, grounding

async def query_rewriter(chat_log: list, query: str)-> str:
    if not chat_log:
        return query

    history = "\n".join(_message_text(message) for message in chat_log[-10:])
    prompt = f"""Rewrite the user's latest question as a standalone search query.
Use the chat history only to resolve references. Keep the rewrite concise.

Chat history:
{history}

Latest question: {query}

Standalone search query:"""
    try:
        rewritten = await asyncio.to_thread(_rewrite_with_ollama, prompt)
    except Exception:
        return query

    rewritten = rewritten.strip().strip('"')
    if not rewritten or len(rewritten) > 500:
        return query
    return rewritten

if __name__ == "__main__":
    print("thanks for using retrieval")
    final, chunks = retrieve(["09c145f4-bfb8-4a29-abf6-98084ff7f9a6.pdf"], "what is the main question?")
    print(final)
