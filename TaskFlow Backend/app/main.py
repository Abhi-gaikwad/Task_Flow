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
# In production, you should restrict the allow_origins list to your actual frontend domain(s)
app.add_middleware(
    CORSMiddleware,
    # Explicitly allow your frontend's development origin
    # If your frontend runs on a different port or domain, update this list
    allow_origins=["http://localhost:5173"], # IMPORTANT: Change this to your frontend's actual URL in production
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers in the request
)

# This command creates the database tables if they don't exist
Base.metadata.create_all(bind=engine)

# Include all routers once with the /api/v1 prefix.
app.include_router(auth_router, tags=["Authentication"], prefix="/api/v1")
app.include_router(users_router, tags=["Users"], prefix="/api/v1")
app.include_router(companies_router, tags=["Companies"], prefix="/api/v1")
app.include_router(tasks_router, tags=["Tasks"], prefix="/api/v1")
app.include_router(notifications_router, tags=["Notifications"], prefix="/api/v1")
app.include_router(profiles_router, tags=["Profiles"], prefix="/api/v1")

# You might want to add a root endpoint for health checks
@app.get("/")
async def read_root():
    return {"message": "Welcome to TaskFlow RBAC API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

