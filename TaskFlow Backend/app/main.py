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
# In production, you should restrict the allow_origins list
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This command creates the database tables if they don't exist
Base.metadata.create_all(bind=engine)

# --- CORRECTED ROUTER INCLUSION ---
# Include all routers once with the /api/v1 prefix.
app.include_router(auth_router, tags=["Authentication"], prefix="/api/v1")
app.include_router(users_router, tags=["Users"], prefix="/api/v1")
app.include_router(companies_router, tags=["Companies"], prefix="/api/v1")
app.include_router(tasks_router, tags=["Tasks"], prefix="/api/v1")
app.include_router(notifications_router, tags=["Notifications"], prefix="/api/v1")
app.include_router(profiles_router, tags=["Profiles"], prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "TaskFlow API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
