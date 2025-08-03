# app/main.py
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

# Create the FastAPI app instance
app = FastAPI(title="TaskFlow RBAC API")

# Add CORS middleware to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create database tables
Base.metadata.create_all(bind=engine)

# Include all routers with the /api/v1 prefix
app.include_router(auth_router, tags=["Authentication"], prefix="/api/v1")
app.include_router(users_router, tags=["Users"], prefix="/api/v1")
app.include_router(companies_router, tags=["Companies"], prefix="/api/v1")
app.include_router(tasks_router, tags=["Tasks"], prefix="/api/v1")
app.include_router(notifications_router, tags=["Notifications"], prefix="/api/v1")
app.include_router(profiles_router, tags=["Profiles"], prefix="/api/v1")

@app.get("/")
async def read_root():
    return {"message": "Welcome to TaskFlow RBAC API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/v1")
async def api_root():
    return {"message": "TaskFlow RBAC API v1"}