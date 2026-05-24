# backend/app/auth.py
"""
Modul utilitas autentikasi — password hashing dan JWT management.

Security:
- Password hashing: bcrypt via passlib (OWASP A02:2021)
- JWT: HS256 symmetric signing via python-jose
- Secret dari environment variable, TIDAK hardcoded (OWASP A07:2021)

@module auth
"""

import os
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — semua dari environment variable
# ---------------------------------------------------------------------------

JWT_SECRET: str = os.getenv("JWT_SECRET", "")
"""JWT signing secret — WAJIB diset di production."""

JWT_ALGORITHM: str = "HS256"
"""JWT signing algorithm — HS256 (symmetric)."""

JWT_EXPIRE_HOURS: int = 24
"""Token expiration time in hours."""

# ---------------------------------------------------------------------------
# Password Hashing (bcrypt)
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
"""Passlib context — bcrypt sebagai default scheme."""


def hash_password(plain_password: str) -> str:
    """
    Hash plain-text password menggunakan bcrypt.

    Params:
        plain_password (str): Password plain-text dari user.

    Returns:
        str: Bcrypt hash string.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifikasi plain-text password terhadap bcrypt hash.

    Params:
        plain_password (str): Password input dari user.
        hashed_password (str): Hash yang tersimpan di database.

    Returns:
        bool: True jika cocok, False jika tidak.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


# ---------------------------------------------------------------------------
# JWT Token
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, email: str) -> str:
    """
    Buat JWT access token dengan payload user.

    Params:
        user_id (int): ID user dari database.
        email (str): Email user.

    Returns:
        str: Encoded JWT token string.

    Raises:
        ValueError: Jika JWT_SECRET tidak dikonfigurasi.
    """
    if not JWT_SECRET:
        raise ValueError(
            "JWT_SECRET environment variable tidak diset. "
            "Set di file .env sebelum menjalankan server."
        )

    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)

    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    logger.info(f"JWT token created for user_id={user_id}")
    return token


def decode_access_token(token: str) -> dict:
    """
    Decode dan verifikasi JWT token.

    Params:
        token (str): JWT token string.

    Returns:
        dict: Decoded payload.

    Raises:
        HTTPException (401): Jika token invalid atau expired.
    """
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured.",
        )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# FastAPI Dependency — get current user from Bearer token
# ---------------------------------------------------------------------------

security_scheme = HTTPBearer()
"""FastAPI HTTP Bearer security scheme."""


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: extract dan validasi user dari Bearer token.

    Params:
        credentials: HTTP Authorization header (auto-injected).
        db: Database session (auto-injected).

    Returns:
        User: SQLAlchemy User object dari database.

    Raises:
        HTTPException (401): Token invalid/expired atau user tidak ditemukan.
    """
    payload = decode_access_token(credentials.credentials)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user:
        logger.warning(f"User not found for token sub={user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
