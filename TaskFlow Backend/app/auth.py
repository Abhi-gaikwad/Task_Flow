from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole, Company
from app.config import settings
import os
from dotenv import load_dotenv

load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")


def get_password_hash(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_access_token(entity_id: int, entity_type: str = "user") -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(entity_id), "type": entity_type, "exp": exp},
        settings.secret_key,
        algorithm=settings.algorithm
    )


def authenticate_user(db: Session, email_or_username: str, password: str) -> User | None:
    """Authenticate user (including SuperAdmin) only from DB."""
    # Try to find user by email first, then by username
    user = db.query(User).filter(
        (User.email == email_or_username) | (User.username == email_or_username)
    ).first()
    
    if not user:
        print(f"[DEBUG] No user found with email/username: {email_or_username}")
        return None
        
    if not user.hashed_password:
        print(f"[DEBUG] User {email_or_username} has no hashed_password")
        return None
        
    if not verify_password(password, user.hashed_password):
        print(f"[DEBUG] Password verification failed for: {email_or_username}")
        return None
        
    if not user.is_active:
        print(f"[DEBUG] User {email_or_username} is not active")
        return None
        
    print(f"[DEBUG] User authentication successful: {user.email} (Role: {user.role})")
    return user

def authenticate_company(db: Session, username_or_email: str, password: str) -> Company | None:
    """Authenticate a company directly from DB."""
    company = db.query(Company).filter(
        (Company.company_username == username_or_email) |
        (Company.company_email == username_or_email)
    ).first()

    if not company:
        return None
    if not company.is_active:
        return None
    if not company.company_hashed_password:
        return None
    if not verify_password(password, company.company_hashed_password):
        return None

    return company


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    cred_exc = HTTPException(status_code=401, detail="Invalid token")

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        uid_str = payload.get("sub")
        entity_type = payload.get("type", "user")
        if not uid_str:
            raise cred_exc
        uid = int(uid_str)
    except (JWTError, ValueError):
        raise cred_exc

    # Handle company
    if entity_type == "company":
        company = db.get(Company, uid)
        if not company or not company.is_active:
            raise cred_exc
        company_user = User(
            id=company.id,
            email=company.company_email,
            username=company.company_username,
            role=UserRole.COMPANY,
            company_id=company.id,
            is_active=company.is_active,
            hashed_password="",
            created_at=company.created_at or datetime.utcnow(),
            can_assign_tasks=True
        )
        return company_user

    # Handle normal users (including SUPER_ADMIN)
    user: User | None = db.get(User, uid)
    if not user or not user.is_active:
        raise cred_exc
    return user



def require(role: UserRole):
    def _guard(user: User = Depends(get_current_user)):
        if user.role != role:
            raise HTTPException(status_code=403, detail=f"{role} required")
        return user
    return _guard


def require_company_or_admin():
    def _guard(user: User = Depends(get_current_user)):
        if user.role not in [UserRole.COMPANY, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Company or Admin role required")
        return user
    return _guard


def require_company_admin_or_super():
    def _guard(user: User = Depends(get_current_user)):
        if user.role not in [UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            raise HTTPException(status_code=403, detail="Company, Admin, or Super Admin role required")
        return user
    return _guard


super_admin_only = require(UserRole.SUPER_ADMIN)
company_only = require(UserRole.COMPANY)
admin_only = require(UserRole.ADMIN)
