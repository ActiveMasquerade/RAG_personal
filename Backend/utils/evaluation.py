import asyncio
import datetime
import logging
import random

from Backend.schemas.data_classes import (
    EvalQueryResult,
    EvalQuestion,
    EvalRunSummary,
)
from Backend.utils.clients import get_eval_llm, get_vector_store
from Backend.utils.database import get_all_docs
from Backend.utils.retrieval import retrieve

logger = logging.getLogger(__name__)

QUESTION_GENERATION_PROMPT = """You are creating a test question for a document retrieval system.
Read the excerpt below and write ONE specific question that can be answered using ONLY this excerpt.

Rules:
1. Output ONLY the question, nothing else.
2. Do NOT reference "the excerpt", "the document", or "the text" in the question.
3. The question must be answerable from the excerpt alone, without outside knowledge.

Excerpt:
{excerpt}

Question:
"""


# ---------------------------------------------------------------------------
# Pure metric functions (no I/O — unit-testable)
# ---------------------------------------------------------------------------

def hit_at_k(expected_document_id: str, retrieved_document_ids: list[str]) -> bool:
    return expected_document_id in retrieved_document_ids


def reciprocal_rank(expected_document_id: str, retrieved_document_ids: list[str]) -> float:
    for rank, document_id in enumerate(retrieved_document_ids, start=1):
        if document_id == expected_document_id:
            return 1.0 / rank
    return 0.0


def precision_at_k(expected_document_id: str, retrieved_document_ids: list[str]) -> float:
    if not retrieved_document_ids:
        return 0.0
    relevant = sum(1 for doc_id in retrieved_document_ids if doc_id == expected_document_id)
    return relevant / len(retrieved_document_ids)


def recall_at_k(expected_document_id: str, retrieved_document_ids: list[str]) -> float:
    return 1.0 if hit_at_k(expected_document_id, retrieved_document_ids) else 0.0


def score_query(expected_document_id: str, retrieved_document_ids: list[str]) -> dict:
    return {
        "hit": hit_at_k(expected_document_id, retrieved_document_ids),
        "reciprocal_rank": reciprocal_rank(expected_document_id, retrieved_document_ids),
        "precision": precision_at_k(expected_document_id, retrieved_document_ids),
        "recall": recall_at_k(expected_document_id, retrieved_document_ids),
    }


def aggregate_metrics(results: list[EvalQueryResult]) -> dict:
    if not results:
        return {"hit_rate": 0.0, "mrr": 0.0, "precision_at_k": 0.0, "recall_at_k": 0.0}
    count = len(results)
    return {
        "hit_rate": sum(r.hit for r in results) / count,
        "mrr": sum(r.reciprocal_rank for r in results) / count,
        "precision_at_k": sum(r.precision for r in results) / count,
        "recall_at_k": sum(r.recall for r in results) / count,
    }


# ---------------------------------------------------------------------------
# Golden set generation
# ---------------------------------------------------------------------------

def _generate_question_helper(excerpt: str) -> str:
    return get_eval_llm().invoke(QUESTION_GENERATION_PROMPT.format(excerpt=excerpt))


async def _sample_chunks(user_id: str, doc_ids: list[str] | None, sample_size: int) -> list[dict]:
    vector_store = get_vector_store()
    where: dict = {"user_id": user_id}
    if doc_ids:
        where = {"$and": [{"user_id": user_id}, {"document_id": {"$in": doc_ids}}]}

    stored_chunks = vector_store._collection.get(
        where=where,
        include=["documents", "metadatas"],
    )
    chunks = [
        {"text": text, "metadata": metadata}
        for text, metadata in zip(stored_chunks.get("documents", []), stored_chunks.get("metadatas", []))
        if text and text.strip()
    ]
    if len(chunks) <= sample_size:
        return chunks
    return random.sample(chunks, sample_size)


async def generate_golden_set(
    user_id: str,
    num_questions: int = 10,
    doc_ids: list[str] | None = None,
) -> list[EvalQuestion]:
    sampled_chunks = await _sample_chunks(user_id, doc_ids, num_questions)
    if not sampled_chunks:
        return []

    questions: list[EvalQuestion] = []
    for chunk in sampled_chunks:
        excerpt = chunk["text"].strip()
        metadata = chunk["metadata"] or {}
        document_id = metadata.get("document_id")
        if not document_id:
            continue
        try:
            raw_question = await asyncio.to_thread(_generate_question_helper, excerpt)
        except Exception:
            logger.exception("failed to generate eval question for document %s", document_id)
            continue

        question_text = raw_question.strip().strip('"')
        if not question_text:
            continue

        questions.append(
            EvalQuestion(
                user_id=user_id,
                query=question_text,
                expected_document_id=document_id,
                expected_document_name=metadata.get("file_name"),
                expected_chunk_index=metadata.get("chunk_index"),
                source_excerpt=excerpt[:500],
                created_at=datetime.datetime.now(),
            )
        )
    return questions


# ---------------------------------------------------------------------------
# Running an evaluation against a golden set
# ---------------------------------------------------------------------------

async def run_evaluation(
    user_id: str,
    questions: list[dict],
    k: int = 5,
    doc_ids: list[str] | None = None,
) -> tuple[EvalRunSummary, list[EvalQueryResult]]:
    search_scope = doc_ids or [doc["_id"] for doc in await get_all_docs(user_id)]

    results: list[EvalQueryResult] = []
    for question in questions:
        _, _, grounding = await retrieve(
            search_scope,
            question["query"],
            user_id,
            chat_history=[],
            threshold=0,
            top_k=k,
        )
        retrieved_document_ids = [atom["document_id"] for atom in grounding][:k]
        scores = score_query(question["expected_document_id"], retrieved_document_ids)
        results.append(
            EvalQueryResult(
                question_id=question.get("_id"),
                query=question["query"],
                expected_document_id=question["expected_document_id"],
                retrieved_document_ids=retrieved_document_ids,
                **scores,
            )
        )

    metrics = aggregate_metrics(results)
    summary = EvalRunSummary(
        user_id=user_id,
        k=k,
        num_questions=len(results),
        created_at=datetime.datetime.now(),
        **metrics,
    )
    return summary, results
