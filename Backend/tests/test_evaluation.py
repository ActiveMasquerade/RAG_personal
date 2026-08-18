from Backend.schemas.data_classes import EvalQueryResult
from Backend.utils.evaluation import (
    aggregate_metrics,
    hit_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
    score_query,
)


def test_hit_at_k_true_when_expected_present():
    assert hit_at_k("doc-1", ["doc-3", "doc-1", "doc-2"]) is True


def test_hit_at_k_false_when_expected_absent():
    assert hit_at_k("doc-1", ["doc-3", "doc-2"]) is False


def test_reciprocal_rank_uses_first_matching_position():
    assert reciprocal_rank("doc-1", ["doc-3", "doc-1", "doc-1"]) == 0.5


def test_reciprocal_rank_zero_when_missing():
    assert reciprocal_rank("doc-1", []) == 0.0


def test_precision_at_k_counts_relevant_fraction():
    assert precision_at_k("doc-1", ["doc-1", "doc-1", "doc-2", "doc-3"]) == 0.5


def test_precision_at_k_zero_for_empty_results():
    assert precision_at_k("doc-1", []) == 0.0


def test_recall_at_k_is_binary_for_single_relevant_doc():
    assert recall_at_k("doc-1", ["doc-2", "doc-1"]) == 1.0
    assert recall_at_k("doc-1", ["doc-2", "doc-3"]) == 0.0


def test_score_query_bundles_all_metrics():
    scores = score_query("doc-1", ["doc-1", "doc-2"])
    assert scores == {
        "hit": True,
        "reciprocal_rank": 1.0,
        "precision": 0.5,
        "recall": 1.0,
    }


def test_aggregate_metrics_averages_across_results():
    results = [
        EvalQueryResult(
            query="q1",
            expected_document_id="doc-1",
            retrieved_document_ids=["doc-1"],
            hit=True,
            reciprocal_rank=1.0,
            precision=1.0,
            recall=1.0,
        ),
        EvalQueryResult(
            query="q2",
            expected_document_id="doc-2",
            retrieved_document_ids=["doc-3"],
            hit=False,
            reciprocal_rank=0.0,
            precision=0.0,
            recall=0.0,
        ),
    ]
    metrics = aggregate_metrics(results)
    assert metrics == {
        "hit_rate": 0.5,
        "mrr": 0.5,
        "precision_at_k": 0.5,
        "recall_at_k": 0.5,
    }


def test_aggregate_metrics_empty_results():
    assert aggregate_metrics([]) == {
        "hit_rate": 0.0,
        "mrr": 0.0,
        "precision_at_k": 0.0,
        "recall_at_k": 0.0,
    }
