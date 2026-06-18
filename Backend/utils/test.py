from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
EmbeddingModel = OllamaEmbeddings(model="embeddinggemma:300m")

storage = Chroma(
        collection_name="local_rag",
        embedding_function = EmbeddingModel,
        persist_directory="/home/kaniss/RAG_personal/Backend/chromadb",

    )
results = (storage.get())
print(results)