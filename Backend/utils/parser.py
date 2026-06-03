from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import CSVLoader
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_core.documents import Document
from rich.pretty import pprint
def parseCSV(file_path: str,document_id:str, delimiter: str=",") -> list[Document]:
    loader = CSVLoader(
        file_path=file_path,
        csv_args = {"delimiter":delimiter}
    )
    csv_document: list[Document] = loader.load()
    for document in csv_document:
        document.metadata["delimiter"] = delimiter
        document.metadata["document_id"] = document_id
        document.metadata["file_type"] = "csv"
    print(csv_document[0].metadata)
    return csv_document;
def parsePDF(file_path: str, document_id: str) -> list[Document]:
    loader = PyPDFLoader(
        extraction_mode="layout",
        file_path=file_path
        )
    pdf_document: list[Document] = loader.load()
    for document in pdf_document:
        document.metadata = {
            "page": document.metadata.get("page"),
            "page_label": document.metadata.get("page_label",None),
            "file_type": "pdf",
            "document_id": document_id,
            "total_pages" : document.metadata.get("total_pages"),
        }
    return pdf_document
def parseMD(file_path: str, document_id: str) -> list[Document]:
    loader = TextLoader(
        file_path=file_path,
        encoding="utf-8"
    )
    raw_file = loader.load()
    rudiment_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on = [
        ("#", "h1"),
        ("##", "h2"),
        ("###", "h3"),
        ]
    )
    print((raw_file[0].metadata))
    documents: list[Document] = rudiment_splitter.split_text(raw_file[0].page_content)
    for doc in documents:
        doc.metadata["file_type"] = "md"
        doc.metadata["document_id"] = document_id
    return documents
def parseTXT(file_path:str,document_id:str) -> list[Document]:
    loader = TextLoader(
        file_path=file_path,
        encoding="utf-8"
    )
    document = loader.load()
    for doc in document:
        doc.metadata["document_id"] = document_id
        doc.metadata["file_type"] = "txt"
    return document
if __name__ == "__main__":
    docs = parseTXT("/home/kanisss/RAG_personal/Backend/documents/README.md", "12345")
    pprint(docs)