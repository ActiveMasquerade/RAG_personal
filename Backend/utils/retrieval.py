from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_chroma import Chroma

def retrieve(docs,query):
    embedding_model = OllamaEmbeddings(model="embeddinggemma:300m")

    vector_store = Chroma(
        collection_name = "local_rag",
        persist_directory="/home/kanisss/RAG_personal/Backend/chromadb",
        embedding_function=embedding_model
    )

    

    chunks = vector_store.similarity_search(query=query,
                                            k=5,
                                            filter={
                                                "document_id":{
                                                    "$in": docs
                                                },
                                                
                                            })


    context = '\n\n'.join(chunk.page_content for chunk in chunks)

    final_query = f"""answer the question below with the given context:
    question: {query}

    context:{context}

    """
    
    return final_query, chunks
if __name__ == "__main__":
    print("thanks for using retrieval")
    final, chunks = retrieve(["09c145f4-bfb8-4a29-abf6-98084ff7f9a6.pdf"], "what is the main question?")
    print(final)