from pydantic import BaseModel

class QueryRequest(BaseModel):
    docs: list[str]
    query : str
