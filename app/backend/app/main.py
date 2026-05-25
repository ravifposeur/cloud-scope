import logging
from fastapi import FastAPI
from app.db.database import engine, Base
from app.db import models
from app.api.routers import analysis
from app.api.routers import auth
# Create tables
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CloudScope API",
    description="API Gateway untuk platform analisis citra mikroskop berbasis cloud.",
    version="0.1.0",
    root_path="/api"
)

# Daftarkan router
app.include_router(analysis.router)
app.include_router(auth.router)
@app.on_event("startup")
async def startup_event():
    logger.info("CloudScope API berjalan.")

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "CloudScope API"}
