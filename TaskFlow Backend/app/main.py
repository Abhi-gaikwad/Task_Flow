from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import router  # ← Change 'routers' to 'router'

app = FastAPI(title="TaskFlow RBAC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

Base.metadata.create_all(bind=engine)

# Use 'router' not 'routers'
app.include_router(router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}
