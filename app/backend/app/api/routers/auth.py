from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.core.security import verify_password, create_access_token
from app.db import crud

router = APIRouter(prefix="/auth", tags=["Authentication"])

class UserCreate(BaseModel):
    email: str
    name: str  # <--- DIUBAH DARI username MENJADI name
    password: str
    affiliation: Optional[str] = None

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already used")

    new_user = crud.create_user(db=db, user_data=user)
    return {"message": f"User {new_user.name} berhasil dibuat"}

@router.post("/login")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # 1. PENTING: Selalu gunakan form_data.username (meskipun isinya nanti adalah email)
    user = crud.get_user_by_email(db, email=form_data.username)

    # 2. Validasi eksistensi user dan kecocokan password hashing
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Jika valid, buat token (ambil identitas email langsung dari objek user DB)
    access_token = create_access_token(data={"sub": user.email})

    # 4. Kembalikan token sesuai standar OAuth2
    return {"access_token": access_token, "token_type": "bearer"}
