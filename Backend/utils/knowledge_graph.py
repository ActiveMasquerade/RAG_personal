import logging
import math
from collections import defaultdict
from typing import Any, Dict, List

from Backend.utils.clients import get_vector_store
from Backend.utils.database import get_all_docs

logger = logging.getLogger(__name__)


def helper_calculate_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Calculates the cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)


def helper_calculate_centroid(embeddings: List[List[float]]) -> List[float]:
    """Averages a list of embedding vectors to find their center point (centroid)."""
    if not embeddings:
        return []
    
    dimensions = len(embeddings[0])
    count = len(embeddings)
    return [sum(vector[i] for vector in embeddings) / count for i in range(dimensions)]


def helper_calculate_token_relevance(doc_a: Dict[str, Any], doc_b: Dict[str, Any]) -> float:
    """Fallback relevance calculation using a Jaccard similarity of filename tokens."""
    def extract_tokens(doc: Dict[str, Any]) -> set:
        name = doc.get("file_name", doc.get("label", "")).lower()
        return set(name.replace(".", " ").replace("_", " ").split())

    tokens_a = extract_tokens(doc_a)
    tokens_b = extract_tokens(doc_b)

    # Boost relevance if they are the exact same file type
    if doc_a.get("file_type") == doc_b.get("file_type") and doc_a.get("file_type"):
        tokens_a.add(doc_a.get("file_type"))
        tokens_b.add(doc_b.get("file_type"))
        
    union = tokens_a | tokens_b
    if not union:
        return 0.0
        
    return len(tokens_a & tokens_b) / len(union)


async def build_knowledge_graph(user_id: str) -> Dict[str, Any]:
    documents = await get_all_docs(user_id)
    
    nodes = [
        {
            "id": str(doc["_id"]),
            "label": doc.get("original_file_name", "Unknown"),
            "file_type": doc.get("file_type", "unknown"),
            "uploaded_at": str(doc.get("upload_time", "")),
            "chunk_count": 0,
        }
        for doc in documents
    ]
    
    node_by_id = {node["id"]: node for node in nodes}
    embeddings_by_document: Dict[str, List[List[float]]] = defaultdict(list)

    try:
        vector_store = get_vector_store()

        stored_chunks = vector_store._collection.get(
            where={"user_id": user_id},
            include=["embeddings", "metadatas"],
        )

        for embedding, metadata in zip(stored_chunks.get("embeddings", []), stored_chunks.get("metadatas", [])):
            doc_id = metadata.get("document_id")
            if doc_id in node_by_id:
                node_by_id[doc_id]["chunk_count"] += 1
                embeddings_by_document[doc_id].append(list(embedding))

    except Exception:
        # If Chroma fails, we gracefully fallback to token-based relevance
        logger.exception("Knowledge graph Chroma lookup failed")
        embeddings_by_document = defaultdict(list)

    # Calculate the central vector representing each document
    centroids = {
        doc_id: helper_calculate_centroid(embeddings)
        for doc_id, embeddings in embeddings_by_document.items()
        if embeddings
    }

    links = []
    
    # Cross-reference every document to build connections
    for i, left_node in enumerate(nodes):
        for right_node in nodes[i + 1:]:
            left_id = left_node["id"]
            right_id = right_node["id"]
            
            # Determine relevance strategy
            if left_id in centroids and right_id in centroids:
                relevance = helper_calculate_cosine_similarity(centroids[left_id], centroids[right_id])
            else:
                relevance = helper_calculate_token_relevance(left_node, right_node)
            
            # Clamp relevance to prevent negative cosine similarities
            relevance = max(0.0, relevance)
            
            if relevance > 0:
                links.append({
                    "source": left_id,
                    "target": right_id,
                    "relevance": round(relevance, 4), # Explicitly format the relevance score for the frontend
                })

    # Sort connections by highest relevance and cap the output map size
    links.sort(key=lambda link: link["relevance"], reverse=True)
    max_links = max(len(nodes) * 3, 12)
    
    return {
        "nodes": nodes,
        "links": links[:max_links]
    }