from rich.pretty import pprint
from pymongo import AsyncMongoClient, ReturnDocument
from bson import ObjectId
from bson.errors import InvalidId
import os
import datetime
from Backend.schemas.data_classes import Chat, ChatUpdateRequest, Mongo_Document


def _database():
    client = AsyncMongoClient(os.environ["MONGODB_URL"])
    return client.get_database("RAG")


def _serialize_user(user: dict | None) -> dict | None:
    if not user:
        return None
    user["_id"] = str(user["_id"])
    return user


async def create_user(email: str, password_hash: str, full_name: str | None = None) -> dict:
    database = _database()
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


async def get_user_by_email(email: str) -> dict | None:
    database = _database()
    collection = database.get_collection("users")
    user = await collection.find_one({"email": email})
    return _serialize_user(user)


async def get_user_by_id(user_id: str) -> dict | None:
    database = _database()
    collection = database.get_collection("users")
    try:
        object_id = ObjectId(user_id)
    except InvalidId:
        return None
    user = await collection.find_one({"_id": object_id})
    return _serialize_user(user)


async def Mongo_document_upload(source: str, file_type: str, saved_file_name: str, user_id: str, original_file_name:str):
    database = _database()
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
async def get_all_docs(user_id: str | None = None)-> list[dict]:
    database = _database()
    collection = database.get_collection("documents")
    query = {"user_id": user_id} if user_id else {}
    response = await collection.find(query).to_list()
    for doc in response:
        doc["_id"] =  str(doc["_id"])
    return response

def _serialize_chat(chat: dict | None) -> dict | None:
    if not chat:
        return None
    chat["_id"] = str(chat["_id"])
    return chat

async def create_chat(docs: list[str], chat_name: str, user_id: str):
    database = _database()
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
    return _serialize_chat(chat)

async def get_chats(user_id:str)-> list[Chat]:
    database = _database()
    collection = database.get_collection("chats")
    response = await collection.find({"user_id":user_id}).to_list()
    for doc in response:
        doc["_id"] = str(doc["_id"])
    return response

async def update_chat(chat_id:str, user_id:str, chat: ChatUpdateRequest):
    database = _database()
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
    return _serialize_chat(response)
