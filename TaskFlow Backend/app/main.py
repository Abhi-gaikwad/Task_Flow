from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import (
    auth_router,
    users_router,
    companies_router,
    tasks_router,
    notifications_router,
    profiles_router
)

app = FastAPI(title="TaskFlow RBAC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, restrict this in production!
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

Base.metadata.create_all(bind=engine)

from app.routers import auth_router
app.include_router(auth_router)
app.include_router(auth_router, tags=["auth"], prefix="/api/v1")
app.include_router(users_router, tags=["users"], prefix="/api/v1")
app.include_router(companies_router, tags=["companies"], prefix="/api/v1")
app.include_router(tasks_router, tags=["tasks"], prefix="/api/v1")
app.include_router(notifications_router, tags=["notifications"], prefix="/api/v1")
app.include_router(profiles_router, tags=["profiles"], prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}