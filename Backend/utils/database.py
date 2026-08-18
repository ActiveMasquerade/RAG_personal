from pymongo import AsyncMongoClient, ReturnDocument
from bson import ObjectId
from bson.errors import InvalidId
import datetime
from Backend.config import get_settings
from Backend.schemas.data_classes import (
    Chat,
    ChatUpdateRequest,
    EvalQuestion,
    EvalRunSummary,
    Mongo_Document,
)

async def update_chat(chat_id:str, user_id:str, chat: ChatUpdateRequest):
    database = database_provider()
    collection = database.get_collection("chats")
    try:
        object_id = ObjectId(chat_id)
    except InvalidId:
        return None

    update = chat.model_dump(exclude_none=True)
    update["updated_at"] = datetime.datetime.now()
    response = await collection.find_one_and_update(
        {"_id": object_id, "user_id": user_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if response is None:
        return None
    response["_id"] = str(response["_id"])
    return response


async def delete_chat(user_id:str, chat_id: str) -> bool:
    database = database_provider()
    collection = database.get_collection("chats")
    try:
        object_id = ObjectId(chat_id)
    except InvalidId:
        return False

    response = await collection.find_one_and_delete(
        {"_id": object_id, "user_id": user_id},
    )
    return response is not None


def serialize_user(user: dict | None) -> dict | None:
    if not user:
        return None
    user["_id"] = str(user["_id"])
    return user


async def get_user_by_email(email: str) -> dict | None:
    database = database_provider()
    collection = database.get_collection("users")
    user = await collection.find_one({"email": email})
    return serialize_user(user)



async def get_user_by_id(user_id: str) -> dict | None:
    database = database_provider()
    collection = database.get_collection("users")
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        return None
    user = await collection.find_one({"_id": object_id})
    return serialize_user(user)


async def create_user(email: str, password_hash: str, full_name: str | None = None) -> dict:
    database = database_provider()
    collection = database.get_collection("users")
    now = datetime.datetime.now(datetime.UTC)
    payload = {
        "email": email,
        "password_hash": password_hash,
        "full_name": full_name,
        "created_at": now,
        "updated_at": now,
    }
    response = await collection.insert_one(payload)
    payload["_id"] = str(response.inserted_id)
    return payload


def database_provider():
    client = AsyncMongoClient(get_settings().mongodb_url)
    return client.get_database("RAG")


async def Mongo_document_upload(source: str, file_type: str, saved_file_name: str, user_id: str, original_file_name:str):
    database = database_provider()
    collection = database.get_collection("documents")
    payload = Mongo_Document(
        original_file_name=original_file_name,
        saved_file_name=saved_file_name,
        file_type=file_type,
        source=source,
        user_id=user_id,
        upload_time= datetime.datetime.now()
        )
    response = await collection.insert_one(payload.model_dump())
    return response
async def get_all_docs(user_id: str)-> list[dict]:
    database = database_provider()
    collection = database.get_collection("documents")
    response = await collection.find({"user_id": user_id}).to_list()
    for doc in response:
        doc["_id"] =  str(doc["_id"])
    return response

async def create_chat(docs: list[str], chat_name: str, user_id: str):
    database = database_provider()
    collection = database.get_collection("chats")
    payload = Chat(
        user_id=user_id,
        docs=docs,
        previous_messages=[],
        chat_name=chat_name,
        created_at=datetime.datetime.now(),
        updated_at=datetime.datetime.now()
        )
    response = await collection.insert_one(payload.model_dump())
    chat = await collection.find_one({"_id": response.inserted_id})
    chat["_id"] = str(chat["_id"])
    return chat

async def get_chats(user_id:str)-> list[Chat]:
    database = database_provider()
    collection = database.get_collection("chats")
    response = await collection.find({"user_id":user_id}).to_list()
    for doc in response:
        doc["_id"] = str(doc["_id"])
    return response


async def save_eval_questions(questions: list[EvalQuestion]) -> list[dict]:
    database = database_provider()
    collection = database.get_collection("eval_questions")
    payloads = [question.model_dump(exclude={"id"}) for question in questions]
    if not payloads:
        return []
    response = await collection.insert_many(payloads)
    for payload, inserted_id in zip(payloads, response.inserted_ids):
        payload["_id"] = str(inserted_id)
    return payloads


async def get_eval_questions(user_id: str) -> list[dict]:
    database = database_provider()
    collection = database.get_collection("eval_questions")
    response = await collection.find({"user_id": user_id}).to_list()
    for doc in response:
        doc["_id"] = str(doc["_id"])
    return response


async def save_eval_run(user_id: str, run: EvalRunSummary, results: list[dict]) -> dict:
    database = database_provider()
    collection = database.get_collection("eval_runs")
    payload = run.model_dump(exclude={"id"})
    payload["user_id"] = user_id
    payload["results"] = results
    response = await collection.insert_one(payload)
    payload["_id"] = str(response.inserted_id)
    return payload


async def get_eval_runs(user_id: str) -> list[dict]:
    database = database_provider()
    collection = database.get_collection("eval_runs")
    response = await collection.find(
        {"user_id": user_id},
        {"results": 0},
    ).sort("created_at", -1).to_list()
    for doc in response:
        doc["_id"] = str(doc["_id"])
    return response


async def get_eval_run(user_id: str, run_id: str) -> dict | None:
    database = database_provider()
    collection = database.get_collection("eval_runs")
    try:
        object_id = ObjectId(run_id)
    except InvalidId:
        return None
    response = await collection.find_one({"_id": object_id, "user_id": user_id})
    if response is None:
        return None
    response["_id"] = str(response["_id"])
    return response
