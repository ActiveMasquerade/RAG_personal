from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_chroma import Chroma

def retrieve(docs):
    embedding_model = OllamaEmbeddings(model="embeddinggemma:300m")

    vector_store = Chroma(
        collection_name = "local_rag",
        persist_directory="/home/kanisss/RAG_personal/Backend/chromadb",
        embedding_function=embedding_model
    )

    query = input("input your query: ")
    

    chunks = vector_store.similarity_search(query=query,
                                            k=5,
                                            filter={
                                                "file_name":{
                                                    "$in": docs
                                                },
                                                
                                            })


    context = '\n\n'.join(chunk.page_content for chunk in chunks)

    final_query = f"""answer the question below with the given context:
    question: {query}

    context:{context}

    """
    i=1
    for chunk in chunks:
        print(i)
        print(str(chunk.page_content))
        i+=1
    return final_query
if __name__ == "__main__":
    print("thanks for using retrieval")
    retrieve(["AI Engineering.pdf"])