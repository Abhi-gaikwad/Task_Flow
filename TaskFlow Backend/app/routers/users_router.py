# app/routers/users_router.py - Enhanced with COMPANY role support
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models import User, UserRole, Company
from app.database import get_db
from app.auth import (
    get_current_user, 
    super_admin_only, 
    get_password_hash,
    require_company_or_admin,
    require_company_admin_or_super
)
from app.schemas import UserCreate, UserResponse, UserUpdate, CompanyAdminCreate

router = APIRouter()

@router.post("/companies/{company_id}/admin", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_company_admin(
    company_id: int,
    admin_data: CompanyAdminCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create an admin user for a specific company.
    Can be accessed by:
    - Super admins (for any company)
    - Company role users (only for their own company)
    """
    print(f"[DEBUG] Creating admin for company {company_id} by user {current_user.id} (role: {current_user.role})")
    
    # Verify company exists
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Permission check
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can create admin for any company
        pass
    elif current_user.role == UserRole.COMPANY:
        # Company role can only create admin for their own company
        if current_user.company_id != company_id:
            raise HTTPException(
                status_code=403, 
                detail="Company users can only create admins for their own company"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Only Super Admins and Company users can create company admins"
        )
    
    # Check for existing email
    if db.query(User).filter(User.email == admin_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check for existing username
    if db.query(User).filter(User.username == admin_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create the admin user
    new_admin = User(
        email=admin_data.email,
        username=admin_data.username,
        hashed_password=get_password_hash(admin_data.password),
        role=UserRole.ADMIN,
        company_id=company_id,
        is_active=True,
        full_name=admin_data.full_name
    )
    
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    
    print(f"[DEBUG] Admin user created with ID: {new_admin.id}")
    return UserResponse.model_validate(new_admin)

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new user. Permissions vary by role:
    - Super Admin: Can create users for any company with any role, and set can_assign_tasks
    - Company: Can create users (including admins) only for their company, and set can_assign_tasks
    - Admin: Can create users only for their company with USER role, and set can_assign_tasks for USER role
    """
    print(f"[DEBUG] Creating user by {current_user.id} (role: {current_user.role})")
    
    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can create any user and set can_assign_tasks
        pass
    elif current_user.role == UserRole.COMPANY:
        # Company role can create users and admins for their own company
        if user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only create users for your company")
        # Company can create USER and ADMIN roles
        if user_data.role not in [UserRole.USER, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Company users can only create USER or ADMIN roles")
    elif current_user.role == UserRole.ADMIN:
        # Admin can only create USER role for their company
        if user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only create users for your company")
        if user_data.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only create USER role")
        # Admins can set can_assign_tasks only for USER role
        # If user_data.role is not USER and can_assign_tasks is True, raise error
        if user_data.role != UserRole.USER and user_data.can_assign_tasks:
            raise HTTPException(status_code=403, detail="Admins can only grant task assignment permission to USER role")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate company exists if company_id is provided
    if user_data.company_id:
        company = db.query(Company).filter(Company.id == user_data.company_id).first()
        if not company:
            raise HTTPException(status_code=400, detail="Company not found")
    
    # Check for existing email
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check for existing username
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create the user
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        company_id=user_data.company_id,
        is_active=user_data.is_active,
        can_assign_tasks=user_data.can_assign_tasks # Set the new field
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"[DEBUG] User created with ID: {new_user.id}")
    return UserResponse.model_validate(new_user)

@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List users based on current user's permissions:
    - Super Admin: Can see all users
    - Company: Can see users in their company
    - Admin: Can see users in their company
    - User: Cannot access this endpoint
    """
    print(f"[DEBUG] Listing users for {current_user.id} (role: {current_user.role})")
    
    if current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = db.query(User)
    
    # Filter by company for company and admin roles
    if current_user.role in [UserRole.COMPANY, UserRole.ADMIN]:
        query = query.filter(User.company_id == current_user.company_id)
    
    # Apply filters
    if role:
        try:
            role_enum = UserRole(role)
            query = query.filter(User.role == role_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    users = query.offset(skip).limit(limit).all()
    print(f"[DEBUG] Found {len(users)} users")
    return [UserResponse.model_validate(user) for user in users]

@router.get("/users/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return UserResponse.model_validate(current_user)

@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific user by ID.
    Permissions:
    - Super Admin: Can view any user
    - Company/Admin: Can view users in their company
    - User: Can view their own profile
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can view any user
        pass
    elif current_user.role in [UserRole.COMPANY, UserRole.ADMIN]:
        # Company and admin can view users in their company
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this user")
    elif current_user.id != user_id:
        # Regular users can only view their own profile
        raise HTTPException(status_code=403, detail="Not authorized to view this user")
    
    return UserResponse.model_validate(user)

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a user's information.
    Permissions:
    - Super Admin: Can update any user, including can_assign_tasks
    - Company: Can update users in their company (except roles or company_id), including can_assign_tasks
    - Admin: Can update users in their company (limited fields, can set can_assign_tasks for USER role)
    - User: Can update their own profile (limited fields)
    """
    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    # Permission checks and field restrictions
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can update any field for any user
        pass
    elif current_user.role == UserRole.COMPANY:
        # Company can update users in their company but with restrictions
        if user_to_update.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this user")
        # Company cannot change role or company_id of other users
        if user_update.role is not None and user_update.role != user_to_update.role:
            raise HTTPException(status_code=403, detail="Company users cannot change user roles")
        if user_update.company_id is not None and user_update.company_id != user_to_update.company_id:
            raise HTTPException(status_code=403, detail="Company users cannot change user's company")
    elif current_user.role == UserRole.ADMIN:
        # Admin can update users in their company with restrictions
        if user_to_update.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this user")
        # Admins cannot change role or company_id of other users
        if user_update.role is not None and user_update.role != user_to_update.role:
            raise HTTPException(status_code=403, detail="Admins cannot change user roles")
        if user_update.company_id is not None and user_update.company_id != user_to_update.company_id:
            raise HTTPException(status_code=403, detail="Admins cannot change user's company")
        # Admins can only update regular users, not other admins or company users
        if user_to_update.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only update regular users")
        # Admins can change can_assign_tasks only for USER role
        # If user_to_update.role is not USER and user_update.can_assign_tasks is True, raise error
        if user_to_update.role != UserRole.USER and user_update.can_assign_tasks is not None and user_update.can_assign_tasks:
            raise HTTPException(status_code=403, detail="Admins can only grant task assignment permission for USER role")
    elif current_user.id == user_id:
        # Regular users can only update specific fields on their own profile
        allowed_fields = ["email", "username", "password"]
        for field in user_update.model_dump(exclude_unset=True):
            if field not in allowed_fields:
                raise HTTPException(status_code=403, detail=f"User not authorized to update '{field}'")
        # Regular users cannot change can_assign_tasks on their own profile
        if user_update.can_assign_tasks is not None:
            raise HTTPException(status_code=403, detail="You cannot change your own task assignment permission")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for key, value in update_data.items():
        setattr(user_to_update, key, value)
    
    db.commit()
    db.refresh(user_to_update)
    return UserResponse.model_validate(user_to_update)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deactivate a user (soft delete).
    Permissions:
    - Super Admin: Can deactivate any user
    - Company: Can deactivate users in their company
    - Admin: Can deactivate regular users in their company
    """
    user_to_deactivate = db.query(User).filter(User.id == user_id).first()
    if not user_to_deactivate:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deactivating self
    if user_to_deactivate.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can deactivate any user
        pass
    elif current_user.role == UserRole.COMPANY:
        # Company can deactivate users in their company
        if user_to_deactivate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to deactivate this user")
        # Company users cannot deactivate other company users
        if user_to_deactivate.role == UserRole.COMPANY:
            raise HTTPException(status_code=403, detail="Company users cannot deactivate other company users")
    elif current_user.role == UserRole.ADMIN:
        # Admin can deactivate regular users in their company
        if user_to_deactivate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to deactivate this user")
        # Prevent admin from deactivating company users or other admins
        if user_to_deactivate.role in [UserRole.ADMIN, UserRole.COMPANY]:
            raise HTTPException(status_code=403, detail="Admins can only deactivate regular users")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to deactivate users")

    user_to_deactivate.is_active = False # Soft delete
    db.commit()
    return {"message": "User deactivated successfully"}

@router.post("/users/{user_id}/activate", response_model=UserResponse)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate a deactivated user.
    Permissions:
    - Super Admin: Can activate any user
    - Company: Can activate users in their company
    - Admin: Can activate regular users in their company
    """
    user_to_activate = db.query(User).filter(User.id == user_id).first()
    if not user_to_activate:
        raise HTTPException(status_code=404, detail="User not found")

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can activate any user
        pass
    elif current_user.role == UserRole.COMPANY:
        # Company can activate users in their company
        if user_to_activate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to activate this user")
    elif current_user.role == UserRole.ADMIN:
        # Admin can activate regular users in their company
        if user_to_activate.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized to activate this user")
        # Admins can only activate regular users
        if user_to_activate.role != UserRole.USER:
            raise HTTPException(status_code=403, detail="Admins can only activate regular users")
    else:
        raise HTTPException(status_code=403, detail="Not authorized to activate users")

    user_to_activate.is_active = True
    db.commit()
    db.refresh(user_to_activate)
    return UserResponse.model_validate(user_to_activate)
