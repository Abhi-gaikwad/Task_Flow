# app/routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import (
    authenticate_user,
    authenticate_company,
    create_access_token,
    get_current_user
)
from app.models import User
from app.schemas import UserResponse
from pydantic import BaseModel

router = APIRouter()


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


@router.post("/login", response_model=LoginResponse)
async def unified_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Unified login endpoint:
    1. Try company authentication first.
    2. If company authentication fails with 401, try user authentication.
    """
    print(f"[DEBUG] Unified login attempt for: {form_data.username}")

    try:
        # First try company authentication
        try:
            company_user = authenticate_company(
                db, form_data.username, form_data.password)
            if company_user:
                print(
                    f"[DEBUG] Company login successful: {company_user.username}")
                access_token = create_access_token(company_user.id)
                user_response = UserResponse.model_validate(company_user)
                return LoginResponse(
                    access_token=access_token,
                    token_type="bearer",
                    user=user_response
                )
        except HTTPException as he:
            if he.status_code != status.HTTP_401_UNAUTHORIZED:
                print(
                    f"[DEBUG] Company login failed with non-401 error: {he.detail}")
                raise
            print("[DEBUG] Company login failed with 401, trying user login...")

        # If company login fails with 401, try user authentication
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            print(f"[DEBUG] User login failed for: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username/email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"[DEBUG] User login successful: {user.username}")
        access_token = create_access_token(user.id)
        user_response = UserResponse.model_validate(user)
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )

    except HTTPException:
        raise
    except Exception as e:
        print(
            f"[DEBUG] Unexpected error during unified login: {type(e).__name__}: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed due to an internal error"
        )


@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user's profile
    """
    print(
        f"[DEBUG] Getting current user profile for ID: {current_user.id}, Role: {current_user.role}")
    try:
        user_response = UserResponse.model_validate(current_user)
        print(f"[DEBUG] Current user profile response created successfully")
        return user_response
    except Exception as e:
        print(f"[DEBUG] Error creating current user response: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user profile: {str(e)}"
        )
