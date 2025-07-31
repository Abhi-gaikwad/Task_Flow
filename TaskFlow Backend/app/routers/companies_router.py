from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user, get_password_hash
from app.schemas import CompanyResponse, CompanyCreate

router = APIRouter()

# Removed: Schema for creating company with admin

# Removed: Endpoint for Super Admins to create a new Company with its first admin user.

@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(super_admin_only)
):
    """
    Endpoint for Super Admins to create a new Company with its own login credentials.
    """
    # Check for existing company by name
    if db.query(Company).filter(Company.name == company_data.name).first():
        raise HTTPException(status_code=400, detail="A company with this name already exists.")
    
    # Check for existing company username
    if db.query(Company).filter(Company.company_username == company_data.company_username).first():
        raise HTTPException(status_code=400, detail="This company username is already taken.")

    # Create the company instance
    new_company = Company(
        name=company_data.name,
        description=company_data.description,
        company_username=company_data.company_username,
        company_hashed_password=get_password_hash(company_data.company_password),
        is_active=True
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    return new_company

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all companies (for super admin) or the user's company (for admin/user).
    """
    if user.role == UserRole.SUPER_ADMIN:
        return db.query(Company).all()
    elif user.company_id:
        return db.query(Company).filter(Company.id == user.company_id).all()
    return []