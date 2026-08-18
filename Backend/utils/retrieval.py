import asyncio
import logging

from Backend.utils.clients import get_cohere_client, get_rewrite_llm, get_vector_store

logger = logging.getLogger(__name__)

RERANK_MODEL = "rerank-v4.0-fast"
DEFAULT_THRESHOLD = 75


def query_rewrite_helper(prompt: str) -> str:
    return get_rewrite_llm().invoke(prompt)


async def retrieve(
    docs,
    query,
    user_id: str,
    chat_history: list | None = None,
    threshold: int = DEFAULT_THRESHOLD,
    top_k: int = 5,
):
    k = top_k
    rewritten_query = await query_rewriter(chat_history or [], query)
    vector_store = get_vector_store()
    chunks = vector_store.similarity_search(query=rewritten_query,
                                            k= max(20, k) ,
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

    refined_chunks_index = get_cohere_client().rerank(
            model=RERANK_MODEL,
            query=rewritten_query,
            documents=rerank_input_chunks,
            top_n = k,

    )
    results = refined_chunks_index.results
    min_score = max(0.0, min(100, threshold)) / 100
    kept_results = [r for r in results if r.relevance_score >= min_score] or results[:1]
    refined_chunks = [chunks[refined.index] for refined in kept_results]
    context = '\n\n'.join(chunk.page_content for chunk in refined_chunks)

    final_query = f"""answer the question below with the given context, make sure to use correct markdown, make use of headings, lists where necessary :
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
    if(len(chat_log)==0): return query
    history = ""
    for chat in chat_log:
        chat = chat.model_dump()
        role = chat.get("role", "")
        content = chat.get("content","")
        message = f"{role}:{content}"
        history = "\n".join([history, message])
    prompt = f"""
Rewrite the latest question into a standalone search query.

Rules:
1. Output ONLY the rewritten query.
2. Do NOT explain.
3. Do NOT justify.
4. Do NOT describe what you changed.
5. Do NOT write complete sentences unless they are the query itself.
6. If no rewrite is needed, output the original question exactly.

Chat History:
{history}

Question:
{query}

Query:
"""
    try:
        rewritten = await asyncio.to_thread(query_rewrite_helper, prompt)
    except Exception:
        logger.exception("returning original query due to ollama failure")
        return query

    rewritten = rewritten.strip().strip('"')
    logger.debug("rewritten query: %s", rewritten)
    if not rewritten:
        return query
    return rewritten