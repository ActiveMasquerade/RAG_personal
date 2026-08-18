import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from Backend.utils.clients import get_vector_store

logger = logging.getLogger(__name__)


def ingest(documents: list[Document]) -> None:
    try:
        chunker = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = chunker.split_documents(documents)
        for index, chunk in enumerate(chunks):
            chunk.metadata["chunk_index"] = index
        get_vector_store().add_documents(documents=chunks)
    except Exception:
        logger.exception("error in ingestion")
