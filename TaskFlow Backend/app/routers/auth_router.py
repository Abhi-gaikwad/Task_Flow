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
from app.models import User, Company
from app.schemas import UserResponse
from pydantic import BaseModel

router = APIRouter()


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict   # we allow dict since company response is not exactly UserResponse


@router.post("/login", response_model=LoginResponse)
async def unified_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    username = form_data.username
    password = form_data.password
    print(f"[DEBUG ROUTER] === UNIFIED LOGIN STARTED ===")
    print(f"[DEBUG ROUTER] Username: '{username}'")
    print(f"[DEBUG ROUTER] Password provided: {bool(password)}")
    print(f"[DEBUG ROUTER] Password length: {len(password) if password else 0}")

    # Try user login FIRST (includes SuperAdmin, Admin, normal users)
    print(f"[DEBUG ROUTER] Attempting user authentication...")
    user = authenticate_user(db, username, password)
    
    if user:
        print(f"[DEBUG ROUTER] ✅ User authentication SUCCESS")
        print(f"[DEBUG ROUTER] User details - ID: {user.id}, Email: {user.email}, Role: {user.role}")
        
        try:
            access_token = create_access_token(user.id, entity_type="user")
            print(f"[DEBUG ROUTER] Access token created successfully")
            
            user_response = UserResponse.model_validate(user)
            print(f"[DEBUG ROUTER] UserResponse validation successful")
            
            result = LoginResponse(
                access_token=access_token,
                token_type="bearer",
                user=user_response.model_dump()
            )
            print(f"[DEBUG ROUTER] === UNIFIED LOGIN COMPLETED SUCCESSFULLY ===")
            return result
            
        except Exception as e:
            print(f"[DEBUG ROUTER] ❌ Error creating response: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating login response: {str(e)}"
            )
    else:
        print(f"[DEBUG ROUTER] ❌ User authentication FAILED")

    # Fallback to company login if user login fails
    print(f"[DEBUG ROUTER] Attempting company authentication...")
    company = authenticate_company(db, username, password)
    
    if company:
        print(f"[DEBUG ROUTER] ✅ Company authentication SUCCESS")
        print(f"[DEBUG ROUTER] Company details - ID: {company.id}, Username: {company.company_username}")
        
        try:
            access_token = create_access_token(company.id, entity_type="company")
            print(f"[DEBUG ROUTER] Company access token created successfully")
            
            result = LoginResponse(
                access_token=access_token,
                token_type="bearer",
                user={
                    "id": company.id,
                    "email": company.company_email,
                    "username": company.company_username,
                    "role": "COMPANY",
                    "company_id": company.id,
                    "is_active": company.is_active,
                    "can_assign_tasks": True
                }
            )
            print(f"[DEBUG ROUTER] === UNIFIED LOGIN COMPLETED SUCCESSFULLY (COMPANY) ===")
            return result
            
        except Exception as e:
            print(f"[DEBUG ROUTER] ❌ Error creating company response: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating company login response: {str(e)}"
            )
    else:
        print(f"[DEBUG ROUTER] ❌ Company authentication FAILED")

    # Both authentications failed
    print(f"[DEBUG ROUTER] ❌❌ ALL AUTHENTICATION METHODS FAILED ❌❌")
    print(f"[DEBUG ROUTER] === UNIFIED LOGIN FAILED ===")
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username/email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/company-login", response_model=LoginResponse)
async def company_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Dedicated company login endpoint (if needed for direct company access)"""
    username = form_data.username
    password = form_data.password
    print(f"[DEBUG ROUTER] === COMPANY LOGIN STARTED ===")
    print(f"[DEBUG ROUTER] Company username: '{username}'")
    print(f"[DEBUG ROUTER] Password provided: {bool(password)}")

    company = authenticate_company(db, username, password)
    if not company:
        print(f"[DEBUG ROUTER] ❌ Company login failed for: {username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect company username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    print(f"[DEBUG ROUTER] ✅ Company login successful: {company.company_username}")
    access_token = create_access_token(company.id, entity_type="company")
    
    result = LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": company.id,
            "email": company.company_email,
            "username": company.company_username,
            "role": "COMPANY",
            "company_id": company.id,
            "is_active": company.is_active,
            "can_assign_tasks": True
        }
    )
    print(f"[DEBUG ROUTER] === COMPANY LOGIN COMPLETED SUCCESSFULLY ===")
    return result


@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    print(f"[DEBUG ROUTER] Getting current user profile for ID: {current_user.id}, Role: {current_user.role}")
    try:
        return UserResponse.model_validate(current_user)
    except Exception as e:
        print(f"[DEBUG ROUTER] ❌ Error validating user response: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting user profile: {str(e)}"
        )