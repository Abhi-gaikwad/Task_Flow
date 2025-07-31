# app/routers/companies_router.py (No changes from your original, just for completeness)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user, get_password_hash
from app.schemas import CompanyResponse, CompanyCreate # Assuming AdminCreate schema is gone or unused

router = APIRouter()

@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(super_admin_only)
):
    """
    Endpoint for Super Admins to create a new Company with its own login credentials.
    This creates the company. No separate admin user is created here.
    """
    # Check for existing company by name
    if db.query(Company).filter(Company.name == company_data.name).first():
        raise HTTPException(
            status_code=400, 
            detail="A company with this name already exists."
        )
    
    # Check for existing company username
    if db.query(Company).filter(Company.company_username == company_data.company_username).first():
        raise HTTPException(
            status_code=400, 
            detail="This company username is already taken."
        )

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

@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific company by ID.
    Super admins can access any company, others can only access their own.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Permission check
    if user.role != UserRole.SUPER_ADMIN and user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return company

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    updates: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a company. Super admins can update any company,
    admins can only update their own company (limited fields).
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Permission check
    if user.role == UserRole.SUPER_ADMIN:
        # Super admin can update any field
        allowed_fields = ['name', 'description', 'is_active', 'company_username']
        for field, value in updates.items():
            if field in allowed_fields and hasattr(company, field):
                setattr(company, field, value)
    elif user.role == UserRole.ADMIN and user.company_id == company_id:
        # Company admin can only update description
        allowed_fields = ['description']
        for field, value in updates.items():
            if field in allowed_fields and hasattr(company, field):
                setattr(company, field, value)
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.commit()
    db.refresh(company)
    return company