# app/routers/users_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from app.auth import get_current_user, get_password_hash
from app.models import User, Company, UserRole
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.database import get_db

router = APIRouter()


@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # RBAC validation
    if current_user.role == UserRole.ADMIN:
        if user_data.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot create super admin users")
        
        # Force company_id to be the admin's company for admin users
        if user_data.company_id is None:
            user_data.company_id = current_user.company_id
        elif user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only create users in your own company")
            
    elif current_user.role != UserRole.SUPER_ADMIN:
         # Only admins and superadmins can create users.
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Validate company exists if company_id is provided
    if user_data.company_id:
        company = db.get(Company, user_data.company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        company_id=user_data.company_id,
        is_active=user_data.is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List users based on the current user's role:
    - Super Admin: sees all company admins
    - Admin: sees all users in their company (excluding super admins)  
    - User: sees only themselves
    """
    # Eagerly load company data to include it in the response
    query = db.query(User).options(joinedload(User.company))

    # Apply authorization filters based on the current user's role
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super Admins see all Company Admins by default (unless role filter is specified)
        if role is None:
            query = query.filter(User.role == UserRole.ADMIN)
        else:
            query = query.filter(User.role == role)
    elif current_user.role == UserRole.ADMIN:
        # Company Admins see all users within their own company
        query = query.filter(User.company_id == current_user.company_id)
        # Admins should not see Super Admins in their user list
        query = query.filter(User.role != UserRole.SUPER_ADMIN)
    else:
        # Regular users can only see their own profile
        query = query.filter(User.id == current_user.id)

    # Apply optional filters from the query parameters
    if role and current_user.role == UserRole.SUPER_ADMIN:
        # Only super admin can filter by role (already handled above)
        pass
    elif role and current_user.role != UserRole.SUPER_ADMIN:
        # Non-super admins can still filter by role within their scope
        query = query.filter(User.role == role)
        
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # Order by creation date (newest first) for better UX
    query = query.order_by(User.created_at.desc())

    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).options(joinedload(User.company)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Authorization check
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can view any user
        pass
    elif current_user.role == UserRole.ADMIN:
        # Admin can only view users in their company
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied: cannot view users outside your company.")
        # Admin cannot view super admin users
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Access denied: cannot view super admin users.")
    elif user.id != current_user.id:
        # Regular users can only view themselves
        raise HTTPException(status_code=403, detail="Access denied: can only view your own profile.")

    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).options(joinedload(User.company)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Authorization and field filtering based on role
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can modify company admins
        if user.role == UserRole.SUPER_ADMIN and user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot modify other super admin users")
        allowed_fields = user_update.dict(exclude_unset=True)
    elif current_user.role == UserRole.ADMIN:
        # Admin can modify users in their company
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only update users in your company")
        if user.role == UserRole.SUPER_ADMIN or user_update.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot modify super admin users")
        allowed_fields = user_update.dict(exclude_unset=True)
    else:
        # Regular users can only modify themselves and limited fields
        if user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only update your own profile")
        allowed_fields = {k: v for k, v in user_update.dict(exclude_unset=True).items() 
                         if k in ['email', 'username', 'password']}

    # Validate unique constraints
    if 'email' in allowed_fields and db.query(User).filter(
        User.email == allowed_fields['email'], 
        User.id != user_id
    ).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if 'username' in allowed_fields and db.query(User).filter(
        User.username == allowed_fields['username'], 
        User.id != user_id
    ).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Apply updates
    for field, value in allowed_fields.items():
        if field == 'password' and value:
            setattr(user, 'hashed_password', get_password_hash(value))
        else:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    # Authorization check
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can deactivate company admins but not other super admins
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot deactivate other super admin users")
    elif current_user.role == UserRole.ADMIN:
        # Admin can deactivate users in their company
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only delete users in your company")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot delete super admin users")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Soft delete
    user.is_active = False
    db.commit()

    return {"message": f"User {user.username} has been deactivated"}


@router.post("/users/{user_id}/activate")
def activate_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Authorization check
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can activate company admins but not other super admins
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot activate other super admin users")
    elif current_user.role == UserRole.ADMIN:
        # Admin can activate users in their company
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot modify super admin users")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user.is_active = True
    db.commit()

    return {"message": f"User {user.username} has been activated"}