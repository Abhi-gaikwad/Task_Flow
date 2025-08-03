# app/routers/companies_router.py - Enhanced with better validation and error handling
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user, get_password_hash
from app.schemas import CompanyResponse, CompanyCreate

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
    print(f"[DEBUG] Creating company with data: {company_data.model_dump()}")
    
    # Validate required fields
    if not company_data.name or not company_data.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Company name is required and cannot be empty."
        )
    
    if not company_data.company_username or not company_data.company_username.strip():
        raise HTTPException(
            status_code=400,
            detail="Company username is required and cannot be empty."
        )
    
    if not company_data.company_password or len(company_data.company_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Company password is required and must be at least 6 characters long."
        )
    
    # Check for existing company by name
    existing_company_by_name = db.query(Company).filter(Company.name == company_data.name.strip()).first()
    if existing_company_by_name:
        print(f"[DEBUG] Company with name '{company_data.name}' already exists")
        raise HTTPException(
            status_code=400, 
            detail="A company with this name already exists."
        )
    
    # Check for existing company username
    existing_company_by_username = db.query(Company).filter(Company.company_username == company_data.company_username.strip()).first()
    if existing_company_by_username:
        print(f"[DEBUG] Company username '{company_data.company_username}' is already taken")
        raise HTTPException(
            status_code=400, 
            detail="This company username is already taken."
        )

    try:
        # Hash the password
        hashed_password = get_password_hash(company_data.company_password)
        print(f"[DEBUG] Password hashed successfully")

        # Create the company instance
        new_company = Company(
            name=company_data.name.strip(),
            description=company_data.description.strip() if company_data.description else None,
            company_username=company_data.company_username.strip(),
            company_hashed_password=hashed_password,
            is_active=True
        )
        
        print(f"[DEBUG] Company object created: {new_company.name}")
        
        db.add(new_company)
        db.commit()
        db.refresh(new_company)
        
        print(f"[DEBUG] Company saved to database with ID: {new_company.id}")

        return new_company
        
    except Exception as e:
        print(f"[DEBUG] Error creating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create company: {str(e)}"
        )

@router.get("/companies", response_model=List[CompanyResponse])
def list_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all companies (for super admin) or the user's company (for admin/user).
    """
    print(f"[DEBUG] Listing companies for user: {user.id}, role: {user.role}")
    
    if user.role == UserRole.SUPER_ADMIN:
        companies = db.query(Company).all()
        print(f"[DEBUG] Super admin - returning {len(companies)} companies")
        return companies
    elif user.company_id:
        companies = db.query(Company).filter(Company.id == user.company_id).all()
        print(f"[DEBUG] Regular user - returning {len(companies)} companies for company_id: {user.company_id}")
        return companies
    
    print(f"[DEBUG] No companies accessible for user")
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
    print(f"[DEBUG] Getting company {company_id} for user: {user.id}, role: {user.role}")
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        print(f"[DEBUG] Company {company_id} not found")
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Permission check
    if user.role != UserRole.SUPER_ADMIN and user.company_id != company_id:
        print(f"[DEBUG] Access denied - user company_id: {user.company_id}, requested: {company_id}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    print(f"[DEBUG] Returning company: {company.name}")
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
    print(f"[DEBUG] Updating company {company_id} with updates: {updates}")
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        print(f"[DEBUG] Company {company_id} not found for update")
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Permission check
    if user.role == UserRole.SUPER_ADMIN:
        # Super admin can update any field
        allowed_fields = ['name', 'description', 'is_active', 'company_username']
        for field, value in updates.items():
            if field in allowed_fields and hasattr(company, field):
                print(f"[DEBUG] Super admin updating {field} to {value}")
                setattr(company, field, value)
    elif user.role == UserRole.ADMIN and user.company_id == company_id:
        # Company admin can only update description
        allowed_fields = ['description']
        for field, value in updates.items():
            if field in allowed_fields and hasattr(company, field):
                print(f"[DEBUG] Admin updating {field} to {value}")
                setattr(company, field, value)
    else:
        print(f"[DEBUG] Access denied for company update")
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        db.commit()
        db.refresh(company)
        print(f"[DEBUG] Company updated successfully")
        return company
    except Exception as e:
        print(f"[DEBUG] Error updating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update company: {str(e)}"
        )