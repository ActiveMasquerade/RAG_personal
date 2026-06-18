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
