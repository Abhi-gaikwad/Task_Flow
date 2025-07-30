# app/routers/users_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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
    if current_user.role == UserRole.SUPER_ADMIN:
        # SUPER_ADMIN can only create ADMIN users
        if user_data.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Super admin can only create admin users.")
    elif current_user.role == UserRole.ADMIN:
        if user_data.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot create super admin users")
        if user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only create users in your own company")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

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
    company_id: Optional[int] = Query(None),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User)

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin sees ONLY admin users by default in the user list,
        # regardless of the 'role' query parameter.
        # This simplifies the frontend logic for the dashboard view.
        query = query.filter(User.role == UserRole.ADMIN)
        if company_id:
            query = query.filter(User.company_id == company_id)
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(User.company_id == current_user.company_id)
    else:
        query = query.filter(User.id == current_user.id)

    # Apply additional filters only if the user is NOT a SUPER_ADMIN
    # or if the SUPER_ADMIN wants to further narrow down the ADMIN list
    if current_user.role != UserRole.SUPER_ADMIN and role: # Apply role filter only if not super_admin
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    return query.offset(skip).limit(limit).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can update all fields for any user, but enforce role change restriction
        if user_update.role is not None and user_update.role != user.role and user_update.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Super admin can only change roles to 'admin' or keep current role.")
        allowed_fields = user_update.dict(exclude_unset=True)
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only update users in your company")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot update super admin users")
        if user_update.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot promote users to super admin")
        allowed_fields = user_update.dict(exclude_unset=True)
    else:
        if user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only update your own profile")
        allowed_fields = {k: v for k, v in user_update.dict(exclude_unset=True).items() if k in ['email', 'username', 'password']}

    if 'email' in allowed_fields:
        existing = db.query(User).filter(User.email == allowed_fields['email'], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    if 'username' in allowed_fields:
        existing = db.query(User).filter(User.username == allowed_fields['username'], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

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
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can delete anyone, but if it's a super_admin role trying to delete another super_admin,
        # we might want to prevent that or require extra confirmation. For now, allow but consider.
        pass
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only delete users in your company")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot delete super admin users")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user.is_active = False  # Soft delete
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

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can activate anyone, but prevent changing super_admin role status if desired.
        pass
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot modify super admin users")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user.is_active = True
    db.commit()

    return {"message": f"User {user.username} has been activated"}