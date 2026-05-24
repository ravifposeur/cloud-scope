# backend/app/schemas.py
"""
Pydantic schemas untuk validasi request/response auth endpoints.

Mengikuti standar:
- Input sanitization (OWASP Top 10 - A03:2021 Injection)
- Tidak expose field sensitif (password hash) di response

@module schemas
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    """
    Schema untuk POST /auth/register.

    Params:
        name (str): Nama lengkap user, min 2 karakter.
        email (EmailStr): Email valid, akan di-lowercase.
        password (str): Password min 8 karakter, harus ada uppercase + lowercase + digit.
        affiliation (str | None): Institusi/organisasi, opsional.

    Returns:
        Validated RegisterRequest instance.

    Raises:
        ValidationError: Jika field tidak memenuhi constraint.
    """
    name: str
    email: EmailStr
    password: str
    affiliation: str | None = None

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        """Validasi nama minimal 2 karakter setelah trim."""
        stripped = v.strip()
        if len(stripped) < 2:
            raise ValueError("Nama minimal 2 karakter.")
        return stripped

    @field_validator("email")
    @classmethod
    def email_to_lowercase(cls, v: str) -> str:
        """Normalize email ke lowercase."""
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """
        Validasi kekuatan password:
        - Minimal 8 karakter
        - Harus ada huruf besar, huruf kecil, dan angka
        """
        if len(v) < 8:
            raise ValueError("Password minimal 8 karakter.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password harus mengandung huruf besar.")
        if not any(c.islower() for c in v):
            raise ValueError("Password harus mengandung huruf kecil.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password harus mengandung angka.")
        return v


class LoginRequest(BaseModel):
    """
    Schema untuk POST /auth/login.

    Params:
        email (EmailStr): Email user.
        password (str): Password user.

    Returns:
        Validated LoginRequest instance.
    """
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def email_to_lowercase(cls, v: str) -> str:
        """Normalize email ke lowercase."""
        return v.lower().strip()


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    """
    Schema response user — tidak mengandung password hash.

    Params:
        id (int): User ID.
        email (str): Email user.
        name (str): Nama lengkap.
        affiliation (str | None): Institusi.
        created_at (datetime | None): Waktu registrasi.
    """
    id: int
    email: str
    name: str
    affiliation: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """
    Schema response login — berisi JWT token dan data user.

    Params:
        access_token (str): JWT access token.
        token_type (str): Tipe token, default "bearer".
        user (UserResponse): Data user yang login.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
