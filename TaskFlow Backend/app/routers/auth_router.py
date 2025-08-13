# # app/routers/auth_router.py - Enhanced with comprehensive debugging
# from fastapi import APIRouter, Depends, HTTPException, status
# from fastapi.security import OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session
# from app.database import get_db
# from app.auth import (
#     authenticate_user, 
#     authenticate_company, 
#     create_access_token, 
#     get_current_user
# )
# from app.models import User
# from app.schemas import UserResponse
# from pydantic import BaseModel

# router = APIRouter()

# class LoginResponse(BaseModel):
#     access_token: str
#     token_type: str
#     user: UserResponse

# # Regular user login
# @router.post("/login", response_model=LoginResponse)
# async def login(
#     form_data: OAuth2PasswordRequestForm = Depends(),
#     db: Session = Depends(get_db)
# ):
#     """
#     Regular user login endpoint (includes static superadmin)
#     """
#     print(f"[DEBUG] Regular login attempt for: {form_data.username}")
    
#     try:
#         user = authenticate_user(db, form_data.username, form_data.password)
#         if not user:
#             print(f"[DEBUG] Regular login failed for: {form_data.username} - authentication returned None")
#             raise HTTPException(
#                 status_code=status.HTTP_401_UNAUTHORIZED,
#                 detail="Incorrect email or password",
#                 headers={"WWW-Authenticate": "Bearer"},
#             )
        
#         print(f"[DEBUG] Regular login successful for user ID: {user.id}, Role: {user.role}, Email: {user.email}")
        
#         access_token = create_access_token(user.id)
#         print(f"[DEBUG] Access token created for user ID: {user.id}")
        
#         user_response = UserResponse.model_validate(user)
#         print(f"[DEBUG] UserResponse created successfully")
        
#         return LoginResponse(
#             access_token=access_token,
#             token_type="bearer",
#             user=user_response
#         )
        
#     except HTTPException as he:
#         print(f"[DEBUG] HTTPException in regular login: {he.status_code} - {he.detail}")
#         raise
#     except Exception as e:
#         print(f"[DEBUG] Unexpected error in regular login: {type(e).__name__}: {str(e)}")
#         import traceback
#         print(f"[DEBUG] Traceback: {traceback.format_exc()}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Login failed: {str(e)}"
#         )

# # Company login endpoint
# @router.post("/company-login", response_model=LoginResponse)
# async def company_login(
#     form_data: OAuth2PasswordRequestForm = Depends(),
#     db: Session = Depends(get_db)
# ):
#     """
#     Company login endpoint - logs in as the company's admin user
#     """
#     print(f"[DEBUG] Company login endpoint called for: {form_data.username}")
    
#     try:
#         # Authenticate company and get the associated admin user
#         print(f"[DEBUG] Calling authenticate_company...")
#         admin_user = authenticate_company(db, form_data.username, form_data.password)
        
#         if not admin_user:
#             print(f"[DEBUG] authenticate_company returned None")
#             raise HTTPException(
#                 status_code=status.HTTP_401_UNAUTHORIZED,
#                 detail="Invalid company credentials",
#                 headers={"WWW-Authenticate": "Bearer"},
#             )
        
#         print(f"[DEBUG] Virtual admin user received: ID={admin_user.id}, Username={admin_user.username}, Role={admin_user.role}")
        
#         # Create access token for the admin user
#         print(f"[DEBUG] Creating access token for user ID: {admin_user.id}")
#         access_token = create_access_token(admin_user.id)
#         print(f"[DEBUG] Access token created successfully")
        
#         # Convert user to response format
#         print(f"[DEBUG] Converting user to response format...")
#         try:
#             user_response = UserResponse.model_validate(admin_user)
#             print(f"[DEBUG] User response created successfully")
#             print(f"[DEBUG] User response data: {user_response.model_dump()}")
#         except Exception as e:
#             print(f"[DEBUG] Error creating UserResponse: {e}")
#             print(f"[DEBUG] admin_user attributes: {dir(admin_user)}")
#             print(f"[DEBUG] admin_user.company: {getattr(admin_user, 'company', 'None')}")
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail=f"Error creating user response: {str(e)}"
#             )
        
#         response = LoginResponse(
#             access_token=access_token,
#             token_type="bearer",
#             user=user_response
#         )
        
#         print(f"[DEBUG] Company login response created successfully")
#         return response
        
#     except HTTPException as he:
#         print(f"[DEBUG] HTTPException in company login: {he.status_code} - {he.detail}")
#         raise
#     except Exception as e:
#         print(f"[DEBUG] Unexpected error in company login: {type(e).__name__}: {str(e)}")
#         import traceback
#         print(f"[DEBUG] Traceback: {traceback.format_exc()}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Company login failed: {str(e)}"
#         )

# # Get current user profile
# @router.get("/users/me", response_model=UserResponse)
# async def get_current_user_profile(
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Get current authenticated user's profile
#     """
#     print(f"[DEBUG] Getting current user profile for ID: {current_user.id}, Role: {current_user.role}")
#     try:
#         user_response = UserResponse.model_validate(current_user)
#         print(f"[DEBUG] Current user profile response created successfully")
#         return user_response
#     except Exception as e:
#         print(f"[DEBUG] Error creating current user response: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Error getting user profile: {str(e)}"
#         )

# app/routers/auth_router.py - Enhanced with comprehensive debugging
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

# Regular user login
@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Regular user login endpoint (includes static superadmin)
    """
    print(f"[DEBUG] Regular login attempt for: {form_data.username}")
    
    try:
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            print(f"[DEBUG] Regular login failed for: {form_data.username} - authentication returned None")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"[DEBUG] Regular login successful for user ID: {user.id}, Role: {user.role}, Email: {user.email}")
        
        access_token = create_access_token(user.id)
        print(f"[DEBUG] Access token created for user ID: {user.id}")
        
        user_response = UserResponse.model_validate(user)
        print(f"[DEBUG] UserResponse created successfully")
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except HTTPException as he:
        print(f"[DEBUG] HTTPException in regular login: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        print(f"[DEBUG] Unexpected error in regular login: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

# Company login endpoint
@router.post("/company-login", response_model=LoginResponse)
async def company_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Company login endpoint - logs in as the company's admin user
    """
    print(f"[DEBUG] Company login endpoint called for: {form_data.username}")
    
    try:
        # Authenticate company and get the associated admin user
        print(f"[DEBUG] Calling authenticate_company...")
        admin_user = authenticate_company(db, form_data.username, form_data.password)
        
        if not admin_user:
            print(f"[DEBUG] authenticate_company returned None")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid company credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"[DEBUG] Virtual admin user received: ID={admin_user.id}, Username={admin_user.username}, Role={admin_user.role}")
        
        # Create access token for the admin user
        print(f"[DEBUG] Creating access token for user ID: {admin_user.id}")
        access_token = create_access_token(admin_user.id)
        print(f"[DEBUG] Access token created successfully")
        
        # Convert user to response format
        print(f"[DEBUG] Converting user to response format...")
        try:
            user_response = UserResponse.model_validate(admin_user)
            print(f"[DEBUG] User response created successfully")
            print(f"[DEBUG] User response data: {user_response.model_dump()}")
        except Exception as e:
            print(f"[DEBUG] Error creating UserResponse: {e}")
            print(f"[DEBUG] admin_user attributes: {dir(admin_user)}")
            print(f"[DEBUG] admin_user.company: {getattr(admin_user, 'company', 'None')}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating user response: {str(e)}"
            )
        
        response = LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
        print(f"[DEBUG] Company login response created successfully")
        return response
        
    except HTTPException as he:
        print(f"[DEBUG] HTTPException in company login: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        print(f"[DEBUG] Unexpected error in company login: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Company login failed: {str(e)}"
        )

# Get current user profile
@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user's profile
    """
    print(f"[DEBUG] Getting current user profile for ID: {current_user.id}, Role: {current_user.role}")
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