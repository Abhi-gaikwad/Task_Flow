from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, UserRole, Company
from app.schemas import UserResponse, UserCreate, UserUpdate
from app.auth import get_current_user, super_admin_only, get_password_hash, verify_password

router = APIRouter()

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new user.
    Super admin CANNOT create any user.
    Admin can create USER role within their company.
    """
    # SUPER_ADMIN cannot create any users
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to create individual users. They manage companies."
        )

    # Check for existing email or username
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken.")

    # Authorization logic for ADMIN role
    if current_user.role == UserRole.ADMIN:
        # Admin can only create 'USER' role
        if user_data.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only create 'user' roles.")
        
        # Admin can only create users within their own company
        if user_data.company_id and user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Admins can only create users within their own company.")
        
        # Ensure the user is assigned to the admin's company
        user_data.company_id = current_user.company_id 
    else:
        # Any other role (e.g., USER) cannot create users
        raise HTTPException(status_code=403, detail="Not authorized to create users.")

    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        **user_data.model_dump(exclude={"password"}),
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: Optional[UserRole] = None,
    company_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    List users. Super admin cannot list individual users. Admin can list users in their company.
    """
    query = db.query(User)

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin cannot list individual users
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to list individual users. They manage companies."
        )
    elif current_user.role == UserRole.ADMIN:
        # Admin can only see users within their company, and only regular users
        query = query.filter(User.company_id == current_user.company_id)
        query = query.filter(User.role == UserRole.USER) # Admins manage regular users, not other admins
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
    else:
        # Regular users can only see their own profile (or no access to this endpoint)
        raise HTTPException(status_code=403, detail="Not authorized to list users.")

    users = query.offset(offset).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific user by ID.
    Super admin cannot view individual users.
    Admin can view users within their company.
    User can view their own profile.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Authorization
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to view individual users."
        )
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this user.")
        # Admins can view other users within their company, but typically not other admins
        if user.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only view 'user' roles.")
    elif current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user.")
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a user's information.
    Super admin cannot update individual users.
    Admin can update users within their company (except roles or company_id).
    User can update their own profile (limited fields).
    """
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found.")

    # Authorization
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to update individual users."
        )
    elif current_user.role == UserRole.ADMIN:
        if user_to_update.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this user.")
        # Admins cannot change role or company_id of other users
        if user_update.role is not None and user_update.role != user_to_update.role:
            raise HTTPException(status_code=403, detail="Admins cannot change user roles.")
        if user_update.company_id is not None and user_update.company_id != user_to_update.company_id:
            raise HTTPException(status_code=403, detail="Admins cannot change user's company.")
        # Admins can only update regular users, not other admins
        if user_to_update.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only update 'user' roles.")
    elif current_user.id == user_id:
        # Regular users can only update specific fields on their own profile
        allowed_fields = ["email", "username", "password", "full_name", "avatar_url", "phone_number", "department", "about_me", "preferred_language"]
        for field in user_update.model_dump(exclude_unset=True):
            if field not in allowed_fields:
                raise HTTPException(status_code=403, detail=f"User not authorized to update '{field}'.")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update this user.")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for key, value in update_data.items():
        setattr(user_to_update, key, value)
    
    db.commit()
    db.refresh(user_to_update)
    return user_to_update

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deactivate a user (soft delete).
    Super admin cannot deactivate individual users.
    Admin can deactivate users within their company.
    """
    user_to_deactivate = db.query(User).filter(User.id == user_id).first()
    if not user_to_deactivate:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent deactivating self
    if user_to_deactivate.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    # Authorization
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to deactivate individual users."
        )
    elif current_user.role == UserRole.ADMIN:
        if user_to_deactivate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to deactivate this user.")
        # Prevent admin from deactivating another admin within the same company
        if user_to_deactivate.role == UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admins cannot deactivate other admins.")
        # Admins can only deactivate regular users
        if user_to_deactivate.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only deactivate 'user' roles.")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to deactivate users.")

    user_to_deactivate.is_active = False # Soft delete
    db.commit()
    return {"message": "User deactivated successfully."}

@router.post("/users/{user_id}/activate", response_model=UserResponse)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate a deactivated user.
    Super admin cannot activate individual users.
    Admin can activate users within their company.
    """
    user_to_activate = db.query(User).filter(User.id == user_id).first()
    if not user_to_activate:
        raise HTTPException(status_code=404, detail="User not found.")

    # Authorization
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins are not authorized to activate individual users."
        )
    elif current_user.role == UserRole.ADMIN:
        if user_to_activate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to activate this user.")
        # Admins can only activate regular users
        if user_to_activate.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only activate 'user' roles.")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to activate users.")

    user_to_activate.is_active = True
    db.commit()
    db.refresh(user_to_activate)
    return user_to_activate
