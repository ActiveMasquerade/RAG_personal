import math
from collections import defaultdict

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

from Backend.utils.database import get_all_docs


def _cosine_similarity(first: list[float], second: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(first, second))
    first_norm = math.sqrt(sum(a * a for a in first))
    second_norm = math.sqrt(sum(b * b for b in second))
    if first_norm == 0 or second_norm == 0:
        return 0
    return dot_product / (first_norm * second_norm)


def _average_embedding(embeddings: list[list[float]]) -> list[float]:
    if not embeddings:
        return []
    dimensions = len(embeddings[0])
    return [sum(vector[index] for vector in embeddings) / len(embeddings) for index in range(dimensions)]


def _token_relevance(first: dict, second: dict) -> float:
    first_tokens = set(first.get("file_name", "").lower().replace(".", " ").replace("_", " ").split())
    second_tokens = set(second.get("file_name", "").lower().replace(".", " ").replace("_", " ").split())
    if first.get("file_type") == second.get("file_type"):
        first_tokens.add(first.get("file_type", ""))
        second_tokens.add(second.get("file_type", ""))
    union = first_tokens | second_tokens
    if not union:
        return 0
    return len(first_tokens & second_tokens) / len(union)


async def build_knowledge_graph(user_id: str) -> dict:
    documents = await get_all_docs(user_id)
    nodes = [
        {
            "id": document["_id"],
            "label": document["original_file_name"],
            "file_type": document["file_type"],
            "uploaded_at": str(document.get("upload_time", "")),
            "chunk_count": 0,
        }
        for document in documents
    ]
    node_by_id = {node["id"]: node for node in nodes}
    embeddings_by_document: dict[str, list[list[float]]] = defaultdict(list)

    try:
        vector_store = Chroma(
            collection_name="local_rag",
            persist_directory="/home/kanisss/RAG_personal/Backend/chromadb",
            embedding_function=OllamaEmbeddings(model="embeddinggemma:300m"),
        )
        collection = vector_store._collection
        stored_chunks = collection.get(
            where={"user_id": user_id},
            include=["embeddings", "metadatas"],
        )
        for embedding, metadata in zip(
            stored_chunks.get("embeddings", []),
            stored_chunks.get("metadatas", []),
        ):
            document_id = metadata.get("document_id")
            if document_id not in node_by_id:
                continue
            node_by_id[document_id]["chunk_count"] += 1
            embeddings_by_document[document_id].append(list(embedding))
    except Exception:
        embeddings_by_document = defaultdict(list)

    centroids = {
        document_id: _average_embedding(embeddings)
        for document_id, embeddings in embeddings_by_document.items()
        if embeddings
    }

    links = []
    for left_index, left in enumerate(nodes):
        for right in nodes[left_index + 1:]:
            if left["id"] in centroids and right["id"] in centroids:
                relevance = max(0, _cosine_similarity(centroids[left["id"]], centroids[right["id"]]))
            else:
                relevance = _token_relevance(left, right)
            if relevance <= 0:
                continue
            links.append(
                {
                    "source": left["id"],
                    "target": right["id"],
                    "relevance": round(relevance, 4),
                }
            )

    links.sort(key=lambda link: link["relevance"], reverse=True)
    return {"nodes": nodes, "links": links[: max(len(nodes) * 3, 12)]}
