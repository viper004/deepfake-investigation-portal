from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
import app.models.models  # Import all models to register with SQLAlchemy

app = FastAPI(title="DeepGuard API")

# Configure CORS so frontend can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "DeepGuard Forensic Portal API"}