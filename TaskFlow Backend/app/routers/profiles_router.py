from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.auth import get_current_user, get_password_hash
from app.schemas import UserResponse, UserUpdate
from app.database import get_db
from app.models import User

router = APIRouter()

@router.get("/profile", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserResponse)
def update_profile(profile_update: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    allowed_fields = {k: v for k, v in profile_update.dict(exclude_unset=True).items() if k in ['email', 'username', 'password']}
    for field, value in allowed_fields.items():
        if field == 'password' and value:
            setattr(current_user, 'hashed_password', get_password_hash(value))
        else:
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
