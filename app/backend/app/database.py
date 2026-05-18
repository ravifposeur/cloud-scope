# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@postgres:5432/cloudscope")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the database session in FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()