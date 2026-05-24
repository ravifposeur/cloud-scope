# backend/app/routers/auth_router.py
"""
Auth Router — endpoint autentikasi (register, login, me).

Endpoints:
    POST /auth/register — Registrasi user baru
    POST /auth/login    — Login dan dapatkan JWT token
    GET  /auth/me       — Ambil data user saat ini dari token

Security:
    - Password di-hash dengan bcrypt sebelum disimpan
    - JWT Bearer token untuk otorisasi
    - Semua input divalidasi via Pydantic schemas

@module routers/auth_router
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrasi user baru",
)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Buat akun user baru.

    Flow:
        1. Validasi input (Pydantic — name, email, password strength)
        2. Cek email duplikat di database
        3. Hash password dengan bcrypt
        4. Insert record ke tabel `users`
        5. Return data user (tanpa password hash)

    Params:
        request (RegisterRequest): Data registrasi dari request body.
        db (Session): Database session (auto-injected).

    Returns:
        UserResponse: Data user yang baru dibuat.

    Raises:
        HTTPException (409): Email sudah terdaftar.
        HTTPException (500): Gagal menyimpan ke database.
    """
    # Cek email duplikat
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        logger.warning(f"Registration failed — duplicate email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Gunakan email lain atau login.",
        )

    # Hash password — TIDAK pernah simpan plain text
    hashed = hash_password(request.password)

    # Buat record user baru
    new_user = User(
        email=request.email,
        password=hashed,
        name=request.name,
        affiliation=request.affiliation,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"User registered: id={new_user.id}, email={new_user.email}")
    except Exception as e:
        db.rollback()
        logger.error(f"Database error during registration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal menyimpan data user. Silakan coba lagi.",
        )

    return new_user


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login dan dapatkan JWT token",
)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentikasi user dan return JWT token.

    Flow:
        1. Validasi input (Pydantic)
        2. Query user by email
        3. Verifikasi password terhadap bcrypt hash
        4. Generate JWT access token (HS256, 24h expiry)
        5. Return token + data user

    Params:
        request (LoginRequest): Credential dari request body.
        db (Session): Database session (auto-injected).

    Returns:
        TokenResponse: JWT token + data user.

    Raises:
        HTTPException (401): Email tidak ditemukan atau password salah.
    """
    # Query user by email
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        logger.warning(f"Login failed — email not found: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    # Verifikasi password
    if not verify_password(request.password, user.password):
        logger.warning(f"Login failed — wrong password for: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah.",
        )

    # Generate JWT token
    access_token = create_access_token(user_id=user.id, email=user.email)
    logger.info(f"User logged in: id={user.id}, email={user.email}")

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Ambil data user saat ini",
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Return data user yang sedang login berdasarkan JWT token.

    Params:
        current_user (User): User dari Bearer token (auto-injected).

    Returns:
        UserResponse: Data user saat ini.
    """
    return current_user
