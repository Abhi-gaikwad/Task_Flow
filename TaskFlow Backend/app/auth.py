# app/auth.py - Fix virtual user email format
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole, Company
from app.config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")

def get_password_hash(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": exp},
        settings.secret_key,
        algorithm=settings.algorithm
    )

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """
    Authenticate a regular user by email and password
    """
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user

def authenticate_company(db: Session, company_username: str, company_password: str) -> User:
    """
    Authenticate a company and return a virtual admin user
    """
    print(f"[DEBUG] Company login attempt - Username: {company_username}")
    
    # Find company by username
    company = db.query(Company).filter(Company.company_username == company_username).first()
    if not company:
        print(f"[DEBUG] Company not found with username: {company_username}")
        # List all companies for debugging
        all_companies = db.query(Company).all()
        print(f"[DEBUG] Available companies: {[(c.id, c.name, c.company_username) for c in all_companies]}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid company username or password."
        )
    
    print(f"[DEBUG] Company found: ID={company.id}, Name={company.name}, Active={company.is_active}")
    
    # Check if company has a password hash
    if not company.company_hashed_password:
        print(f"[DEBUG] Company {company.name} has no hashed password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid company username or password."
        )
    
    # Verify password
    password_valid = verify_password(company_password, company.company_hashed_password)
    print(f"[DEBUG] Password verification result: {password_valid}")
    
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid company username or password."
        )
    
    # Check if company is active
    if not company.is_active:
        print(f"[DEBUG] Company {company.name} is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This company account is inactive."
        )
    
    # Create virtual admin user using NEGATIVE ID to avoid conflicts
    virtual_user_id = -(company.id)  # Negative ID for virtual users
    print(f"[DEBUG] Creating virtual admin user with ID: {virtual_user_id}")
    
    # Use a valid email format that passes Pydantic validation
    virtual_email = f"company{company.id}@virtual.example.com"
    
    virtual_admin_user = User(
        id=virtual_user_id,
        email=virtual_email,  # Changed to use .example.com which is valid
        username=f"{company.company_username}_admin",
        role=UserRole.ADMIN,
        company_id=company.id,
        is_active=True,
        hashed_password="virtual-user-no-password",
        created_at=company.created_at or datetime.utcnow()
    )
    
    # Attach company object for frontend use
    virtual_admin_user.company = company
    
    print(f"[DEBUG] Virtual admin user created with email: {virtual_email}")
    return virtual_admin_user

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    cred_exc = HTTPException(status_code=401, detail="Invalid token")
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        uid_str = payload.get("sub")
        if not uid_str:
            raise cred_exc
        uid = int(uid_str)
        print(f"[DEBUG] Token decoded, user ID: {uid}")
    except (JWTError, ValueError) as e:
        print(f"[DEBUG] Token decode error: {e}")
        raise cred_exc
    
    # Handle virtual company admin users (negative IDs)
    if uid < 0:
        company_id = abs(uid)  # Convert negative ID back to company ID
        print(f"[DEBUG] Virtual user detected, company ID: {company_id}")
        
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            print(f"[DEBUG] Company not found for virtual user: {company_id}")
            raise cred_exc
        if not company.is_active:
            print(f"[DEBUG] Company inactive for virtual user: {company_id}")
            raise cred_exc
        
        # Recreate virtual admin user with same email format
        virtual_email = f"company{company.id}@virtual.example.com"
        
        virtual_admin_user = User(
            id=uid,  # Keep the negative ID
            email=virtual_email,  # Use same valid email format
            username=f"{company.company_username}_admin",
            role=UserRole.ADMIN,
            company_id=company.id,
            is_active=True,
            hashed_password="virtual-user-no-password",
            created_at=company.created_at or datetime.utcnow()
        )
        virtual_admin_user.company = company
        
        print(f"[DEBUG] Virtual admin user recreated for token validation")
        return virtual_admin_user
    
    # Handle real users (positive IDs)
    user: User | None = db.get(User, uid)
    if not user:
        print(f"[DEBUG] Real user not found: {uid}")
        raise cred_exc
    if not user.is_active:
        print(f"[DEBUG] Real user inactive: {uid}")
        raise cred_exc
    
    print(f"[DEBUG] Real user authenticated: {user.username}")
    return user

def require(role: UserRole):
    def _guard(user: User = Depends(get_current_user)):
        if user.role != role:
            raise HTTPException(status_code=403, detail=f"{role} required")
        return user
    return _guard

super_admin_only = require(UserRole.SUPER_ADMIN)