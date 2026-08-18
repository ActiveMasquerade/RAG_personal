from pydantic import BaseModel, Field
from datetime import datetime


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CurrentUser(BaseModel):
    id: str
    email: str
    full_name: str | None = None


class QueryRequest(BaseModel):
    docs: list[str]
    query : str
    chat_history: list["ChatMessage"] = Field(default_factory=list)
    threshold: int = Field(default=75, ge=0, le=100)


class Mongo_Document(BaseModel):
    original_file_name: str
    saved_file_name: str
    source: str
    file_type : str
    user_id: str
    upload_time: datetime

class Document_list(BaseModel):
    docs: list[Mongo_Document]

class ChatMessage(BaseModel):
    role: str
    content: str
    docs: list[str] | None = None

class ChatCreateRequest(BaseModel):
    docs: list[str]
    chat_name: str

class ChatUpdateRequest(BaseModel):
    docs: list[str] | None = None
    previous_messages: list[ChatMessage] | None = None
    chat_name: str | None = None

class Chat(BaseModel):
    user_id: str
    docs: list[str]
    previous_messages: list[ChatMessage]
    chat_name: str
    created_at: datetime
    updated_at: datetime


class EvalQuestion(BaseModel):
    id: str | None = None
    user_id: str
    query: str
    expected_document_id: str
    expected_document_name: str | None = None
    expected_chunk_index: int | None = None
    source_excerpt: str
    created_at: datetime


class EvalGenerateRequest(BaseModel):
    num_questions: int = Field(default=10, ge=1, le=50)
    doc_ids: list[str] | None = None


class EvalRunRequest(BaseModel):
    doc_ids: list[str] | None = None
    k: int = Field(default=5, ge=1, le=20)


class EvalQueryResult(BaseModel):
    question_id: str | None = None
    query: str
    expected_document_id: str
    retrieved_document_ids: list[str]
    hit: bool
    reciprocal_rank: float
    precision: float
    recall: float


class EvalRunSummary(BaseModel):
    id: str | None = None
    user_id: str
    k: int
    num_questions: int
    hit_rate: float
    mrr: float
    precision_at_k: float
    recall_at_k: float
    created_at: datetime
