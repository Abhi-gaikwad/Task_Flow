# # app/routers/companies_router.py - Enhanced with COMPANY role support
# from fastapi import APIRouter, Depends, HTTPException, status
# from sqlalchemy.orm import Session
# from typing import List
# from app.models import Company, User, UserRole
# from app.database import get_db
# from app.auth import super_admin_only, get_current_user, get_password_hash, require_company_admin_or_super
# from app.schemas import CompanyResponse, CompanyCreate

# router = APIRouter()

# @router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
# def create_company(
#     company_data: CompanyCreate,
#     db: Session = Depends(get_db),
#     _current_user: User = Depends(super_admin_only)
# ):
#     """
#     Endpoint for Super Admins to create a new Company with its own login credentials.
#     This creates the company. No separate admin user is created here.
#     """
#     print(f"[DEBUG] Creating company with data: {company_data.model_dump()}")
    
#     # Validate required fields
#     if not company_data.name or not company_data.name.strip():
#         raise HTTPException(
#             status_code=400,
#             detail="Company name is required and cannot be empty."
#         )
    
#     if not company_data.company_username or not company_data.company_username.strip():
#         raise HTTPException(
#             status_code=400,
#             detail="Company username is required and cannot be empty."
#         )
    
#     if not company_data.company_password or len(company_data.company_password) < 6:
#         raise HTTPException(
#             status_code=400,
#             detail="Company password is required and must be at least 6 characters long."
#         )
    
#     # Check for existing company by name
#     existing_company_by_name = db.query(Company).filter(Company.name == company_data.name.strip()).first()
#     if existing_company_by_name:
#         print(f"[DEBUG] Company with name '{company_data.name}' already exists")
#         raise HTTPException(
#             status_code=400, 
#             detail="A company with this name already exists."
#         )
    
#     # Check for existing company username
#     existing_company_by_username = db.query(Company).filter(Company.company_username == company_data.company_username.strip()).first()
#     if existing_company_by_username:
#         print(f"[DEBUG] Company username '{company_data.company_username}' is already taken")
#         raise HTTPException(
#             status_code=400, 
#             detail="This company username is already taken."
#         )

#     try:
#         # Hash the password
#         hashed_password = get_password_hash(company_data.company_password)
#         print(f"[DEBUG] Password hashed successfully")

#         # Create the company instance
#         new_company = Company(
#             name=company_data.name.strip(),
#             description=company_data.description.strip() if company_data.description else None,
#             company_username=company_data.company_username.strip(),
#             company_hashed_password=hashed_password,
#             is_active=True
#         )
        
#         print(f"[DEBUG] Company object created: {new_company.name}")
        
#         db.add(new_company)
#         db.commit()
#         db.refresh(new_company)
        
#         print(f"[DEBUG] Company saved to database with ID: {new_company.id}")

#         return new_company
        
#     except Exception as e:
#         print(f"[DEBUG] Error creating company: {str(e)}")
#         db.rollback()
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to create company: {str(e)}"
#         )

# @router.get("/companies", response_model=List[CompanyResponse])
# def list_companies(
#     user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """
#     List all companies based on user role:
#     - Super Admin: Can see all companies
#     - Company: Can see their own company
#     - Admin: Can see their company
#     - User: Can see their company
#     """
#     print(f"[DEBUG] Listing companies for user: {user.id}, role: {user.role}")
    
#     if user.role == UserRole.SUPER_ADMIN:
#         companies = db.query(Company).all()
#         print(f"[DEBUG] Super admin - returning {len(companies)} companies")
#         return companies
#     elif user.company_id:
#         companies = db.query(Company).filter(Company.id == user.company_id).all()
#         print(f"[DEBUG] User with company_id {user.company_id} - returning {len(companies)} companies")
#         return companies
#     else:
#         print(f"[DEBUG] User has no company_id - returning empty list")
#         return []

# @router.get("/companies/{company_id}", response_model=CompanyResponse)
# def get_company(
#     company_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Get a specific company by ID.
#     Permissions:
#     - Super Admin: Can view any company
#     - Company/Admin/User: Can only view their own company
#     """
#     company = db.query(Company).filter(Company.id == company_id).first()
#     if not company:
#         raise HTTPException(status_code=404, detail="Company not found")

#     # Permission checks
#     if current_user.role == UserRole.SUPER_ADMIN:
#         # Super admin can view any company
#         pass
#     elif current_user.company_id == company_id:
#         # Users can view their own company
#         pass
#     else:
#         raise HTTPException(status_code=403, detail="Not authorized to view this company")
    
#     return company

# @router.put("/companies/{company_id}", response_model=CompanyResponse)
# def update_company(
#     company_id: int,
#     company_data: CompanyCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Update a company's information.
#     Permissions:
#     - Super Admin: Can update any company
#     - Company: Can update their own company
#     """
#     company = db.query(Company).filter(Company.id == company_id).first()
#     if not company:
#         raise HTTPException(status_code=404, detail="Company not found")

#     # Permission checks
#     if current_user.role == UserRole.SUPER_ADMIN:
#         # Super admin can update any company
#         pass
#     elif current_user.role == UserRole.COMPANY and current_user.company_id == company_id:
#         # Company role can update their own company
#         pass
#     else:
#         raise HTTPException(status_code=403, detail="Not authorized to update this company")

#     # Validate required fields
#     if not company_data.name or not company_data.name.strip():
#         raise HTTPException(
#             status_code=400,
#             detail="Company name is required and cannot be empty."
#         )
    
#     if not company_data.company_username or not company_data.company_username.strip():
#         raise HTTPException(
#             status_code=400,
#             detail="Company username is required and cannot be empty."
#         )
    
#     if not company_data.company_password or len(company_data.company_password) < 6:
#         raise HTTPException(
#             status_code=400,
#             detail="Company password is required and must be at least 6 characters long."
#         )

#     # Check for existing company by name (excluding current company)
#     existing_company_by_name = db.query(Company).filter(
#         Company.name == company_data.name.strip(),
#         Company.id != company_id
#     ).first()
#     if existing_company_by_name:
#         raise HTTPException(
#             status_code=400, 
#             detail="A company with this name already exists."
#         )
    
#     # Check for existing company username (excluding current company)
#     existing_company_by_username = db.query(Company).filter(
#         Company.company_username == company_data.company_username.strip(),
#         Company.id != company_id
#     ).first()
#     if existing_company_by_username:
#         raise HTTPException(
#             status_code=400, 
#             detail="This company username is already taken."
#         )

#     try:
#         # Update company fields
#         company.name = company_data.name.strip()
#         company.description = company_data.description.strip() if company_data.description else None
#         company.company_username = company_data.company_username.strip()
        
#         # Hash and update password
#         company.company_hashed_password = get_password_hash(company_data.company_password)
        
#         db.commit()
#         db.refresh(company)
        
#         print(f"[DEBUG] Company {company.id} updated successfully")
#         return company
        
#     except Exception as e:
#         print(f"[DEBUG] Error updating company: {str(e)}")
#         db.rollback()
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to update company: {str(e)}"
#         )

# @router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
# def deactivate_company(
#     company_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(super_admin_only)
# ):
#     """
#     Deactivate a company (soft delete).
#     Only Super Admins can deactivate companies.
#     This will also deactivate all users belonging to the company.
#     """
#     company = db.query(Company).filter(Company.id == company_id).first()
#     if not company:
#         raise HTTPException(status_code=404, detail="Company not found")

#     try:
#         # Deactivate the company
#         company.is_active = False
        
#         # Deactivate all users belonging to this company
#         db.query(User).filter(User.company_id == company_id).update({"is_active": False})
        
#         db.commit()
#         print(f"[DEBUG] Company {company_id} and all its users deactivated")
        
#     except Exception as e:
#         print(f"[DEBUG] Error deactivating company: {str(e)}")
#         db.rollback()
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to deactivate company: {str(e)}"
#         )

# @router.post("/companies/{company_id}/activate", response_model=CompanyResponse)
# def activate_company(
#     company_id: int,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(super_admin_only)
# ):
#     """
#     Activate a deactivated company.
#     Only Super Admins can activate companies.
#     Note: This does not automatically reactivate users - they must be activated individually.
#     """
#     company = db.query(Company).filter(Company.id == company_id).first()
#     if not company:
#         raise HTTPException(status_code=404, detail="Company not found")

#     try:
#         company.is_active = True
#         db.commit()
#         db.refresh(company)
        
#         print(f"[DEBUG] Company {company_id} activated")
#         return company
        
#     except Exception as e:
#         print(f"[DEBUG] Error activating company: {str(e)}")
#         db.rollback()
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to activate company: {str(e)}"
#         )


# app/routers/companies_router.py - Enhanced with COMPANY role support
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user, get_password_hash, require_company_admin_or_super
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
    
    if not company_data.company_email or not company_data.company_email.strip(): # NEW VALIDATION
        raise HTTPException(
            status_code=400,
            detail="Company email is required and cannot be empty."
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

    # Check for existing company email (NEW CHECK)
    existing_company_by_email = db.query(Company).filter(Company.company_email == company_data.company_email.strip()).first()
    if existing_company_by_email:
        print(f"[DEBUG] Company email '{company_data.company_email}' is already taken")
        raise HTTPException(
            status_code=400,
            detail="This company email is already taken."
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
            company_email=company_data.company_email.strip(), # NEW FIELD
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
    List all companies based on user role:
    - Super Admin: Can see all companies
    - Company: Can see their own company
    - Admin: Can see their company
    - User: Can see their company
    """
    print(f"[DEBUG] Listing companies for user: {user.id}, role: {user.role}")
    
    if user.role == UserRole.SUPER_ADMIN:
        companies = db.query(Company).all()
        print(f"[DEBUG] Super admin - returning {len(companies)} companies")
        return companies
    elif user.company_id:
        companies = db.query(Company).filter(Company.id == user.company_id).all()
        print(f"[DEBUG] User with company_id {user.company_id} - returning {len(companies)} companies")
        return companies
    else:
        print(f"[DEBUG] User has no company_id - returning empty list")
        return []

@router.get("/companies/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific company by ID.
    Permissions:
    - Super Admin: Can view any company
    - Company/Admin/User: Can only view their own company
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can view any company
        pass
    elif current_user.company_id == company_id:
        # Users can view their own company
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized to view this company")
    
    return company

@router.put("/companies/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a company's information.
    Permissions:
    - Super Admin: Can update any company
    - Company: Can update their own company
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can update any company
        pass
    elif current_user.role == UserRole.COMPANY and current_user.company_id == company_id:
        # Company role can update their own company
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized to update this company")

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
    
    if not company_data.company_email or not company_data.company_email.strip(): # NEW VALIDATION
        raise HTTPException(
            status_code=400,
            detail="Company email is required and cannot be empty."
        )
    
    if not company_data.company_password or len(company_data.company_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Company password is required and must be at least 6 characters long."
        )

    # Check for existing company by name (excluding current company)
    existing_company_by_name = db.query(Company).filter(
        Company.name == company_data.name.strip(),
        Company.id != company_id
    ).first()
    if existing_company_by_name:
        raise HTTPException(
            status_code=400, 
            detail="A company with this name already exists."
        )
    
    # Check for existing company username (excluding current company)
    existing_company_by_username = db.query(Company).filter(
        Company.company_username == company_data.company_username.strip(),
        Company.id != company_id
    ).first()
    if existing_company_by_username:
        raise HTTPException(
            status_code=400, 
            detail="This company username is already taken."
        )

    # Check for existing company email (excluding current company) (NEW CHECK)
    existing_company_by_email = db.query(Company).filter(
        Company.company_email == company_data.company_email.strip(),
        Company.id != company_id
    ).first()
    if existing_company_by_email:
        raise HTTPException(
            status_code=400,
            detail="This company email is already taken."
        )

    try:
        # Update company fields
        company.name = company_data.name.strip()
        company.description = company_data.description.strip() if company_data.description else None
        company.company_username = company_data.company_username.strip()
        company.company_email = company_data.company_email.strip() # NEW FIELD
        
        # Hash and update password
        company.company_hashed_password = get_password_hash(company_data.company_password)
        
        db.commit()
        db.refresh(company)
        
        print(f"[DEBUG] Company {company.id} updated successfully")
        return company
        
    except Exception as e:
        print(f"[DEBUG] Error updating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update company: {str(e)}"
        )

@router.delete("/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(super_admin_only)
):
    """
    Deactivate a company (soft delete).
    Only Super Admins can deactivate companies.
    This will also deactivate all users belonging to the company.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        # Deactivate the company
        company.is_active = False
        
        # Deactivate all users belonging to this company
        db.query(User).filter(User.company_id == company_id).update({"is_active": False})
        
        db.commit()
        print(f"[DEBUG] Company {company_id} and all its users deactivated")
        
    except Exception as e:
        print(f"[DEBUG] Error deactivating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deactivate company: {str(e)}"
        )

@router.post("/companies/{company_id}/activate", response_model=CompanyResponse)
def activate_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(super_admin_only)
):
    """
    Activate a deactivated company.
    Only Super Admins can activate companies.
    Note: This does not automatically reactivate users - they must be activated individually.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        company.is_active = True
        db.commit()
        db.refresh(company)
        
        print(f"[DEBUG] Company {company_id} activated")
        return company
        
    except Exception as e:
        print(f"[DEBUG] Error activating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to activate company: {str(e)}"
        )