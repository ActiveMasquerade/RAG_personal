import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from Backend.schemas.data_classes import CurrentUser, RegisterRequest
from Backend.utils.database import create_user, get_user_by_email, get_user_by_id


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY or SECRET_KEY must be set")
    return secret


def _public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "full_name": user.get("full_name"),
    }


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return password_context.verify(plain_password, password_hash)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    header = {"alg": ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=header["alg"])


def decode_access_token(token: str) -> dict:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise credentials_error


async def register_user(request: RegisterRequest) -> dict:
    email = request.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid email is required")
    existing_user = await get_user_by_email(email)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = await create_user(
        email=email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
    )
    return _public_user(user)


async def authenticate_user(email: str, password: str) -> dict | None:
    user = await get_user_by_email(email.strip().lower())
    if not user or not verify_password(password, user["password_hash"]):
        return None
    return user


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> CurrentUser:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return CurrentUser(**_public_user(user))


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
