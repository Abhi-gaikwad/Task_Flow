from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models import User, Company, Task, UserRole, TaskStatus
from app.auth import (
    get_password_hash, verify_password,
    create_access_token, get_current_user, super_admin_only
)
from datetime import datetime

router = APIRouter()
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: int
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    assigned_to_id: int
    created_by_id: int
    company_id: int
    created_at: datetime
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    
    # Include related user information
    assignee_name: Optional[str] = None
    creator_name: Optional[str] = None
    
    model_config = {"from_attributes": True}
# ── Pydantic Models for Request/Response ─────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: UserRole
    company_id: Optional[int] = None
    is_active: bool = True

class UserUpdate(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    company_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: UserRole
    company_id: Optional[int]
    is_active: bool
    created_at: datetime   
    model_config = {"from_attributes": True}

# ── Auth (Fixed OAuth2 Implementation) ───────────────────────
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2 uses 'username' field for email
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    token = create_access_token(user.id)  # Pass int directly
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "company_id": user.company_id
        }
    }

# ── Company Management (Super Admin Only) ──────────────────
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

# ── Enhanced User Management ────────────────────────────────
@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if email already exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # RBAC validation
    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        if user_data.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot create super admin users")
        if user_data.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only create users in your own company")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Validate company exists
    if user_data.company_id:
        company = db.get(Company, user_data.company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
    
    # Create user
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
    
    # Apply RBAC filtering
    if current_user.role == UserRole.SUPER_ADMIN:
        if company_id:
            query = query.filter(User.company_id == company_id)
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(User.company_id == current_user.company_id)
    else:
        query = query.filter(User.id == current_user.id)
    
    # Apply additional filters
    if role:
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
    
    # RBAC validation
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
    
    # RBAC validation
    if current_user.role == UserRole.SUPER_ADMIN:
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
        allowed_fields = {k: v for k, v in user_update.dict(exclude_unset=True).items() 
                         if k in ['email', 'username', 'password']}
    
    # Validate unique constraints
    if 'email' in allowed_fields:
        existing = db.query(User).filter(User.email == allowed_fields['email'], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    if 'username' in allowed_fields:
        existing = db.query(User).filter(User.username == allowed_fields['username'], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Apply updates
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
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # RBAC validation
    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        if user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Can only delete users in your company")
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Cannot delete super admin users")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Soft delete
    user.is_active = False
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
    
    # RBAC validation
    if current_user.role == UserRole.SUPER_ADMIN:
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

# ── Task Management ──────────────────────────
@router.post("/tasks")
def create_task(
    title: str, 
    description: Optional[str], 
    assigned_to_id: int,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    assignee = db.get(User, assigned_to_id)
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    
    if current_user.role != UserRole.SUPER_ADMIN and assignee.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Cross-company assignment forbidden")

    # Fix field names to match your model
    task = Task(
        title=title, 
        description=description,
        assigned_to_id=assigned_to_id,  # ← Match your model
        created_by_id=current_user.id,  # ← Match your model
        company_id=assignee.company_id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.get("/tasks")
def list_tasks(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if current_user.role == UserRole.SUPER_ADMIN:
        return query.all()
    elif current_user.role == UserRole.ADMIN:
        return query.filter(Task.company_id == current_user.company_id).all()
    else:
        return query.filter(Task.assigned_to_id == current_user.id).all()  # ← Match your model

# ── Profile Management ──────────────────────────
@router.get("/profile", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return current_user

@router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile (limited fields)"""
    allowed_fields = {k: v for k, v in profile_update.dict(exclude_unset=True).items() 
                     if k in ['email', 'username', 'password']}
    
    for field, value in allowed_fields.items():
        if field == 'password' and value:
            setattr(current_user, 'hashed_password', get_password_hash(value))
        else:
            setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user

# Task allocation by admin/creator
@router.post("/tasks", response_model=TaskResponse)
def allocate_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user has permission to allocate tasks
    if current_user.role == UserRole.USER and not current_user.can_assign_tasks:
        raise HTTPException(status_code=403, detail="You don't have permission to assign tasks")
    
    # Validate assignee exists and is in the same company (unless super admin)
    assignee = db.get(User, task_data.assigned_to_id)
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    
    if current_user.role != UserRole.SUPER_ADMIN:
        if assignee.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot assign tasks to users from other companies")
    
    # Create task
    task = Task(
        title=task_data.title,
        description=task_data.description,
        assigned_to_id=task_data.assigned_to_id,
        created_by_id=current_user.id,
        company_id=assignee.company_id,
        due_date=task_data.due_date,
        status=TaskStatus.PENDING
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Add assignee and creator names for response
    task_response = TaskResponse.model_validate(task)
    task_response.assignee_name = assignee.username
    task_response.creator_name = current_user.username
    
    return task_response

# Get tasks allocated to current user
@router.get("/my-tasks", response_model=List[TaskResponse])
def get_my_allocated_tasks(
    status: Optional[TaskStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task).filter(Task.assigned_to_id == current_user.id)
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.offset(skip).limit(limit).all()
    
    # Add creator names
    task_responses = []
    for task in tasks:
        task_response = TaskResponse.model_validate(task)
        creator = db.get(User, task.created_by_id)
        task_response.creator_name = creator.username if creator else "Unknown"
        task_response.assignee_name = current_user.username
        task_responses.append(task_response)
    
    return task_responses

# Update task status (users can only update tasks assigned to them)
@router.put("/tasks/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status: TaskStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Users can only update status of tasks assigned to them
    if current_user.role == UserRole.USER:
        if task.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only update tasks assigned to you")
    # Admins can update tasks in their company
    elif current_user.role == UserRole.ADMIN:
        if task.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    # Super admins can update any task (already handled by role check)
    
    task.status = status
    if status == TaskStatus.COMPLETED:
        task.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    # Add user names for response
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by_id)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    
    return task_response

# Update task details (for admins/creators)
@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check permissions
    can_update = False
    if current_user.role == UserRole.SUPER_ADMIN:
        can_update = True
    elif current_user.role == UserRole.ADMIN and task.company_id == current_user.company_id:
        can_update = True
    elif task.created_by_id == current_user.id:  # Task creator
        can_update = True
    
    if not can_update:
        raise HTTPException(status_code=403, detail="You don't have permission to update this task")
    
    # Update fields
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # Set completion date if marking as completed
    if task_update.status == TaskStatus.COMPLETED and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    
    # Add user names for response
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by_id)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    
    return task_response

# Enhanced task listing with better filtering
@router.get("/tasks", response_model=List[TaskResponse])
def list_all_tasks(
    status: Optional[TaskStatus] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    created_by_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    
    # Apply RBAC filtering
    if current_user.role == UserRole.SUPER_ADMIN:
        pass  # Can see all tasks
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(Task.company_id == current_user.company_id)
    else:
        # Regular users can only see tasks assigned to them or created by them
        query = query.filter(
            (Task.assigned_to_id == current_user.id) | 
            (Task.created_by_id == current_user.id)
        )
    
    # Apply filters
    if status:
        query = query.filter(Task.status == status)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if created_by_id:
        query = query.filter(Task.created_by_id == created_by_id)
    
    tasks = query.offset(skip).limit(limit).all()
    
    # Add user names
    task_responses = []
    for task in tasks:
        task_response = TaskResponse.model_validate(task)
        assignee = db.get(User, task.assigned_to_id)
        creator = db.get(User, task.created_by_id)
        task_response.assignee_name = assignee.username if assignee else "Unknown"
        task_response.creator_name = creator.username if creator else "Unknown"
        task_responses.append(task_response)
    
    return task_responses
