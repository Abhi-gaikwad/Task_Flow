from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.database import get_db
from app.models import User
from app.schemas import UserResponse # Import UserResponse schema
from app.auth import verify_password, create_access_token, get_current_user # Import get_current_user

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Handles user login, providing an access token and user details upon successful authentication.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=400, 
            detail="Invalid email or password"
        )
    
    token = create_access_token(user.id)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "company_id": user.company_id
        }
    }

# --- THIS IS THE CRITICAL NEW ENDPOINT ---
@router.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Fetches the profile for the currently authenticated user.
    This is used by the frontend to validate the session on startup.
    """
    # The get_current_user dependency already fetches the user object.
    # We just need to return it. Pydantic will serialize it correctly.
    return current_user
