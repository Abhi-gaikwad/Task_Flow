from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user, get_password_hash
from app.schemas import CompanyResponse, CompanyWithAdminCreate

router = APIRouter()

@router.post("/companies/with-admin", response_model=CompanyResponse, status_code=201)
def create_company_with_admin(
    data: CompanyWithAdminCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(super_admin_only)
):
    """
    Endpoint for Super Admins to create a new Company and a Company Admin user simultaneously.
    This ensures that every new company has an admin from the start.
    """
    # Check for existing company by name to prevent duplicates
    if db.query(Company).filter(Company.name == data.company_name).first():
        raise HTTPException(status_code=400, detail="A company with this name already exists.")

    # Check for existing user by email or username
    if db.query(User).filter(User.email == data.admin_email).first():
        raise HTTPException(status_code=400, detail="This email is already registered to another user.")
    if db.query(User).filter(User.username == data.admin_username).first():
        raise HTTPException(status_code=400, detail="This username is already taken.")

    # Create the company instance
    new_company = Company(
        name=data.company_name,
        description=data.company_description
    )
    db.add(new_company)
    db.flush()  # Use flush to get the new_company.id before committing the transaction

    # Create the admin user for the new company
    admin_user = User(
        email=data.admin_email,
        username=data.admin_username,
        hashed_password=get_password_hash(data.admin_password),
        role=UserRole.ADMIN,
        company_id=new_company.id,
        is_active=True
    )
    db.add(admin_user)
    
    db.commit()
    db.refresh(new_company)

    return new_company


@router.post("/companies", response_model=CompanyResponse)
def create_company(
    name: str,
    description: Optional[str] = None,
    _sa=Depends(super_admin_only),
    db: Session = Depends(get_db)
):
    company = Company(name=name, description=description)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role == UserRole.SUPER_ADMIN:
        return db.query(Company).all()
    elif user.company_id:
        return db.query(Company).filter(Company.id == user.company_id).all()
    return []
