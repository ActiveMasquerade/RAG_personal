from fastapi import FastAPI, APIRouter, File, UploadFile
import uuid
from shutil import copyfileobj
from pathlib import Path
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware


#import from own modules
from utils.ingestion import ingest
from utils.retrieval import retrieve
from utils.parser import parseCSV, parseMD, parsePDF

from schemas.data_classes import QueryRequest
#end of imports



app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#TODO make separate file for types



@app.get("/login")
def home():
    return {"hello":"damn"}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    document_id = str(uuid.uuid4())
    allowed_types = ["csv","md","pdf"]
    suffix = file.filename.split('.')[-1]
    if(suffix not in allowed_types):
        return {"error":"file not supported"}
    UPLOAD_DIR = Path("../Backend/documents/")
    saved_name = f"{document_id}.{suffix}"
    file_path = UPLOAD_DIR.joinpath(saved_name)
    
    with file_path.open("wb") as buffer:
        copyfileobj(file.file, buffer)
    match suffix:
        case "csv":
            documents = parseCSV(file_path, document_id)
        case "pdf":
            documents = parsePDF(file_path, document_id)
        case "md":
            documents = parseMD(file_path, document_id)
    ingest(documents)
    
    return {
        "saved_filename": f"{document_id}.{suffix}",
        "filename": file.filename
    }
@app.post("/query")
async def query(request: QueryRequest)-> dict:
    print(request)
    final_query, chunks = retrieve(request.docs,request.query)
    return {
        "context":chunks,
        "final_query":final_query}
