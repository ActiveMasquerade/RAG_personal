from functools import lru_cache

import cohere
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from ollama import AsyncClient as OllamaAsyncClient

from Backend.config import get_settings

VECTOR_COLLECTION_NAME = "local_rag"


@lru_cache
def get_embedding_model() -> OllamaEmbeddings:
    settings = get_settings()
    return OllamaEmbeddings(model=settings.embedding_model)


@lru_cache
def get_vector_store() -> Chroma:
    settings = get_settings()
    settings.chroma_persist_dir.mkdir(parents=True, exist_ok=True)
    return Chroma(
        collection_name=VECTOR_COLLECTION_NAME,
        embedding_function=get_embedding_model(),
        persist_directory=str(settings.chroma_persist_dir),
    )


@lru_cache
def get_cohere_client() -> cohere.ClientV2:
    settings = get_settings()
    return cohere.ClientV2(api_key=settings.cohere_key)


@lru_cache
def get_rewrite_llm() -> OllamaLLM:
    settings = get_settings()
    return OllamaLLM(model=settings.ollama_rewrite_model, temperature=0)


@lru_cache
def get_eval_llm() -> OllamaLLM:
    settings = get_settings()
    return OllamaLLM(model=settings.resolved_eval_model, temperature=0.7)


@lru_cache
def get_ollama_client() -> OllamaAsyncClient:
    return OllamaAsyncClient()
