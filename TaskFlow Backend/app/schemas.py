from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.models import UserRole, TaskStatus, TaskPriority, NotificationType

# -----------------
# USER SCHEMAS
# -----------------

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

    model_config = {"from_attributes": True}  # Pydantic v2, for ORM mode (use 'orm_mode = True' for v1)

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
