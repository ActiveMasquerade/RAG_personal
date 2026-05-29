from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
import pathlib
def ingest(file_path):
    path = pathlib.Path(file_path)
    name = path.name
    print(name)
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    chunker = RecursiveCharacterTextSplitter(chunk_size = 1000,
                                         chunk_overlap = 200)
    chunks = chunker.split_documents(documents)
    EmbeddingModel = OllamaEmbeddings(model = 'embeddinggemma:300m')
    for chunk in chunks:
        chunk.metadata["file_name"] = name 
    storage = Chroma(
        collection_name="local_rag",
        embedding_function = EmbeddingModel,
        persist_directory="/home/kanisss/RAG_personal/Backend/chromadb",

    )
    storage.add_documents(
        documents=chunks

    )


if __name__ == "__main__":
    print("hello thanks for using ingestion")
    ingest("/home/kanisss/RAG_personal/Backend/AI Engineering.pdf")
    
    