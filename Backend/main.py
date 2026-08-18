import logging
import uuid
from shutil import copyfileobj
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm

#import from own modules
from Backend.config import get_settings
from Backend.utils.clients import get_ollama_client
from Backend.utils.database import (
    Mongo_document_upload,
    create_chat,
    delete_chat,
    get_all_docs,
    get_chats,
    get_eval_questions,
    get_eval_run,
    get_eval_runs,
    save_eval_questions,
    save_eval_run,
    update_chat,
)
from Backend.utils.evaluation import generate_golden_set, run_evaluation
from Backend.utils.ingestion import ingest
from Backend.utils.knowledge_graph import build_knowledge_graph
from Backend.utils.parser import parseCSV, parseMD, parsePDF, parseTXT
from Backend.utils.retrieval import retrieve
from Backend.schemas.data_classes import (
    ChatCreateRequest,
    ChatUpdateRequest,
    EvalGenerateRequest,
    EvalRunRequest,
    LoginResponse,
    QueryRequest,
    RegisterRequest,
)
from Backend.utils.auth import (
    CurrentUserDep,
    authenticate_user,
    create_access_token,
    register_user,
)
#end of imports

logger = logging.getLogger(__name__)

load_dotenv()
settings = get_settings()

ALLOWED_UPLOAD_TYPES = {"csv", "md", "pdf", "txt"}
UPLOAD_PARSERS = {
    "csv": parseCSV,
    "pdf": parsePDF,
    "md": parseMD,
    "txt": parseTXT,
}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
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
    suffix = file.filename.rsplit(".", 1)[-1].lower()
    file_name = file.filename.rsplit(".", 1)[0]
    if suffix not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type not supported")

    settings.documents_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"{document_id}.{suffix}"
    file_path = settings.documents_dir / saved_name
    with file_path.open("wb") as buffer:
        copyfileobj(file.file, buffer)

    inserted = await Mongo_document_upload(
        original_file_name=file_name,
        saved_file_name=document_id,
        file_type=suffix,
        source=str(file_path),
        user_id=current_user.id,
    )

    parser = UPLOAD_PARSERS[suffix]
    documents = parser(file_path, str(inserted.inserted_id), file_name)
    for document in documents:
        document.metadata["user_id"] = current_user.id
    ingest(documents)

    return {
        "saved_filename": saved_name,
        "filename": file.filename,
    }


@app.post("/query")
async def query(
    request: QueryRequest,
    current_user: CurrentUserDep,
):
    final_query, chunks, grounding = await retrieve(
        request.docs,
        request.query,
        current_user.id,
        request.chat_history[-10:],
        threshold=request.threshold,
    )

    async def generate():
        client = get_ollama_client()

        stream = await client.generate(
            model=settings.generation_model,
            prompt=final_query,
            stream=True,
        )

        async for chunk in stream:
            yield chunk["response"]

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )


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


@app.delete("/chats/{chat_id}")
async def delete_chat_endpoint(
    current_user: CurrentUserDep,
    chat_id: str,
):
    deleted = await delete_chat(current_user.id, chat_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return {"deleted": True}


@app.get("/all-docs")
async def list_documents(current_user: CurrentUserDep):
    return await get_all_docs(current_user.id)


@app.get("/knowledge-graph")
async def knowledge_graph(current_user: CurrentUserDep):
    return await build_knowledge_graph(current_user.id)


@app.post("/eval/generate")
async def generate_eval_set(
    request: EvalGenerateRequest,
    current_user: CurrentUserDep,
):
    questions = await generate_golden_set(current_user.id, request.num_questions, request.doc_ids)
    return await save_eval_questions(questions)


@app.get("/eval/questions")
async def list_eval_questions(current_user: CurrentUserDep):
    return await get_eval_questions(current_user.id)


@app.post("/eval/run")
async def run_eval(
    request: EvalRunRequest,
    current_user: CurrentUserDep,
):
    questions = await get_eval_questions(current_user.id)
    if request.doc_ids:
        questions = [q for q in questions if q["expected_document_id"] in request.doc_ids]
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No eval questions available. Generate a golden set first.",
        )

    summary, results = await run_evaluation(current_user.id, questions, request.k, request.doc_ids)
    return await save_eval_run(current_user.id, summary, [r.model_dump() for r in results])


@app.get("/eval/runs")
async def list_eval_runs(current_user: CurrentUserDep):
    return await get_eval_runs(current_user.id)


@app.get("/eval/runs/{run_id}")
async def get_eval_run_endpoint(
    run_id: str,
    current_user: CurrentUserDep,
):
    run = await get_eval_run(current_user.id, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eval run not found")
    return run
