from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models import UserRole, TaskStatus, TaskPriority, NotificationType

# -----------------
# COMPANY SCHEMAS
# -----------------

class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None

class CompanyCreate(CompanyBase):
    # Fields for company login credentials
    company_username: str
    company_password: str

class CompanyResponse(CompanyBase):
    id: int
    company_username: Optional[str] = None # Include username in response
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# -----------------
# USER SCHEMAS
# -----------------

class UserBase(BaseModel):
    email: EmailStr
    username: str
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role: UserRole
    company_id: Optional[int] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    company_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    role: UserRole
    created_at: datetime
    company: Optional[CompanyResponse] = None  # Added company info for hierarchy

    model_config = {"from_attributes": True}

# Schema for creating admin users by company role
class CompanyAdminCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

# -----------------
# TASK SCHEMAS
# -----------------

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: int
    due_date: Optional[datetime] = None
    priority: TaskPriority = TaskPriority.MEDIUM

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
    priority: TaskPriority
    assigned_to_id: int
    created_by: int
    company_id: int
    created_at: datetime
    due_date: Optional[datetime]
    completed_at: Optional[datetime]

    # Related user info
    assignee_name: Optional[str] = None
    creator_name: Optional[str] = None

    model_config = {"from_attributes": True}

# -----------------
# NOTIFICATION SCHEMAS
# -----------------

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: NotificationType
    title: str
    message: str
    task_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}