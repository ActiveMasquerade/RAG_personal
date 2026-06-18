from typing import Annotated

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
import uuid
from shutil import copyfileobj
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from rich.pretty import pprint

#import from own modules
from Backend.utils.ingestion import ingest
from Backend.utils.retrieval import retrieve
from Backend.utils.knowledge_graph import build_knowledge_graph
from Backend.utils.parser import parseCSV, parseMD, parsePDF, parseTXT
from Backend.utils.database import Mongo_document_upload, create_chat, get_all_docs, get_chats, update_chat
from Backend.schemas.data_classes import ChatCreateRequest, ChatUpdateRequest, LoginResponse, QueryRequest, RegisterRequest
from Backend.utils.auth import (
    CurrentUserDep,
    authenticate_user,
    create_access_token,
    register_user,
)
from dotenv import load_dotenv
#end of imports


load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/register")
async def register(request: RegisterRequest):
    user = await register_user(request)
    access_token = create_access_token(subject=user["id"])
    return LoginResponse(access_token=access_token, user=user)


@app.post("/login")
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    public_user = {
        "id": user["_id"],
        "email": user["email"],
        "full_name": user.get("full_name"),
    }
    access_token = create_access_token(subject=public_user["id"])
    return LoginResponse(access_token=access_token, user=public_user)


@app.get("/me")
async def me(current_user: CurrentUserDep):
    return current_user

@app.post("/upload")
async def upload(
    current_user: CurrentUserDep,
    file: UploadFile = File(...),
):
    document_id = str(uuid.uuid4())
    allowed_types = ["csv","md","pdf"]
    suffix = file.filename.split('.')[-1]
    file_name = file.filename.split('.')[0]
    if(suffix not in allowed_types):
        return {"error":"file not supported"}
    UPLOAD_DIR = Path("/home/kaniss/RAG_personal/Backend/documents/")
    saved_name = f"{document_id}.{suffix}"
    file_path = UPLOAD_DIR.joinpath(saved_name)
    with file_path.open("wb") as buffer:
        copyfileobj(file.file, buffer)
    InsertedID = await Mongo_document_upload(original_file_name=file_name,saved_file_name=document_id, file_type=suffix, source=str(file_path), user_id=current_user.id)

    match suffix:
        case "csv":
            documents = parseCSV(file_path, str(InsertedID.inserted_id), file_name)
        case "pdf":
            documents = parsePDF(file_path, str( InsertedID.inserted_id), file_name)
        case "md":
            documents = parseMD(file_path, str(InsertedID.inserted_id), file_name)
        case "txt":
            documents = parseTXT(file_path, str(InsertedID.inserted_id), file_name)
    for document in documents:
        document.metadata["user_id"] = current_user.id
    ingest(documents)
    
    return {
        "saved_filename": f"{document_id}.{suffix}",
        "filename": file.filename
    }
@app.post("/query")
async def query(
    request: QueryRequest,
    current_user: CurrentUserDep,
)-> dict:
    final_query, chunks, grounding = await retrieve(
        request.docs,
        request.query,
        current_user.id,
        request.chat_history[-10:],
    )
    return {
        "context":chunks,
        "grounding": grounding,
        "final_query":final_query}

@app.post("/chats")
async def create_chat_endpoint(
    request: ChatCreateRequest,
    current_user: CurrentUserDep,
):
    return await create_chat(request.docs, request.chat_name, current_user.id)

@app.get("/chats")
async def get_chats_endpoint(current_user: CurrentUserDep):
    return await get_chats(current_user.id)

@app.patch("/chats/{chat_id}")
async def update_chat_endpoint(
    chat_id: str,
    request: ChatUpdateRequest,
    current_user: CurrentUserDep,
):
    chat = await update_chat(chat_id, current_user.id, request)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat

@app.get("/all-docs")
async def function(current_user: CurrentUserDep):
    response = await get_all_docs(current_user.id)
    return response


@app.get("/knowledge-graph")
async def knowledge_graph(current_user: CurrentUserDep):
    return await build_knowledge_graph(current_user.id)
