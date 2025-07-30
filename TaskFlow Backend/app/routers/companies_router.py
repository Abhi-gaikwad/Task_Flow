from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models import Company, User, UserRole
from app.database import get_db
from app.auth import super_admin_only, get_current_user

router = APIRouter()

@router.post("/companies")
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

@router.get("/companies")
def list_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role == UserRole.SUPER_ADMIN:
        return db.query(Company).all()
    elif user.company_id:
        return db.query(Company).filter(Company.id == user.company_id).all()
    return []
