from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

def ingest(documents: Document):
    chunker = RecursiveCharacterTextSplitter(chunk_size = 1000,
                                         chunk_overlap = 200)
    chunks = chunker.split_documents(documents)
    EmbeddingModel = OllamaEmbeddings(model = 'embeddinggemma:300m')
    for index,chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = index
    storage = Chroma(
        collection_name="local_rag",
        embedding_function = EmbeddingModel,
        persist_directory="/home/kaniss/RAG_personal/Backend/chromadb",

    )
    storage.add_documents(
        documents=chunks

    )
    storage.persist()

if __name__ == "__main__":
    print("hello thanks for using ingestion")

    
    