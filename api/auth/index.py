import hashlib
import hmac
import os
import secrets
import threading
import time
from contextlib import contextmanager
from typing import Optional
from urllib.parse import quote

import psycopg2
from fastapi import FastAPI, Header, HTTPException
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from pydantic import BaseModel, Field

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
_DB_POOL = None
_DB_POOL_LOCK = threading.Lock()

app = FastAPI(title="Eviden Auth API")


class AuthRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)


class UserInfo(BaseModel):
    id: int
    phone: str
    created_at: int


class AuthResponse(BaseModel):
    token: str
    user: UserInfo


def database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL", "").strip()
    if explicit_url:
        return explicit_url
    password = os.getenv("SUPABASE_DB_PASSWORD", "")
    if not password:
        raise RuntimeError("Database credentials are not configured")
    host = os.getenv("SUPABASE_DB_HOST", "")
    port = os.getenv("SUPABASE_DB_PORT", "6543")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    return "postgresql://{0}:{1}@{2}:{3}/postgres".format(
        quote(user, safe=""), quote(password, safe=""), host, port
    )


def postgres_pool() -> ThreadedConnectionPool:
    global _DB_POOL
    if _DB_POOL is not None:
        return _DB_POOL
    with _DB_POOL_LOCK:
        if _DB_POOL is None:
            _DB_POOL = ThreadedConnectionPool(
                1,
                10,
                database_url(),
                cursor_factory=RealDictCursor,
                connect_timeout=6,
                keepalives=1,
                keepalives_idle=5,
                keepalives_interval=2,
                keepalives_count=2,
                tcp_user_timeout=6000,
                sslmode="require",
                options="-c statement_timeout=15000",
            )
    return _DB_POOL


@contextmanager
def db_connection():
    pool = postgres_pool()
    connection = pool.getconn()
    close_connection = False
    try:
        if connection.closed:
            pool.putconn(connection, close=True)
            connection = pool.getconn()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        connection.rollback()
        yield connection
        connection.commit()
    except Exception:
        try:
            connection.rollback()
        except Exception:
            close_connection = True
        raise
    finally:
        pool.putconn(connection, close=close_connection)


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 180000)
    return "{0}${1}".format(salt, digest.hex())


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, _ = stored_hash.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored_hash)


def user_from_row(row) -> UserInfo:
    return UserInfo(id=int(row["id"]), phone=str(row["phone"]), created_at=int(row["created_at"]))


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (%s, %s, %s, %s)",
                (token, user_id, now + TOKEN_TTL_SECONDS, now),
            )
    return token


@app.get("/api/auth/health")
def health_handler():
    return {"ok": True}


@app.post("/api/auth/register", response_model=AuthResponse)
def register_handler(request: AuthRequest):
    now = int(time.time())
    try:
        with db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users(phone, password_hash, created_at) VALUES (%s, %s, %s) RETURNING id",
                    (request.phone, hash_password(request.password), now),
                )
                row = cursor.fetchone()
        user_id = int(row["id"])
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=409, detail="这个手机号已经注册，请直接登录")
    token = create_session(user_id)
    return AuthResponse(token=token, user=UserInfo(id=user_id, phone=request.phone, created_at=now))


@app.post("/api/auth/login", response_model=AuthResponse)
def login_handler(request: AuthRequest):
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, phone, password_hash, created_at FROM users WHERE phone = %s",
                (request.phone,),
            )
            row = cursor.fetchone()
    if row is None or not verify_password(request.password, str(row["password_hash"])):
        raise HTTPException(status_code=401, detail="手机号或密码不正确")
    token = create_session(int(row["id"]))
    return AuthResponse(token=token, user=user_from_row(row))


@app.get("/api/auth/me", response_model=UserInfo)
def me_handler(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = authorization.split(" ", 1)[1].strip()
    now = int(time.time())
    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.phone, u.created_at
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > %s
                """,
                (token, now),
            )
            row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user_from_row(row)
