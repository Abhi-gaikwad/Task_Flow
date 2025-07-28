from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text,
    ForeignKey, Enum as SqlaEnum
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


# ---------- ENUMS -------------------------------------------------
class UserRole(enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN       = "admin"
    USER        = "user"


class TaskStatus(enum.Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED   = "completed"


# ---------- COMPANY ----------------------------------------------
class Company(Base):
    __tablename__ = "companies"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active   = Column(Boolean, default=True, nullable=False)

    # relationships
    users = relationship("User", back_populates="company")
    tasks = relationship("Task", back_populates="company")


# ---------- USER --------------------------------------------------
# ---------- USER --------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, nullable=False)
    username        = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(SqlaEnum(UserRole), default=UserRole.USER, nullable=False)
    company_id      = Column(Integer, ForeignKey("companies.id"))
    is_active       = Column(Boolean, default=True, nullable=False)
    
    # Fixed datetime columns - REMOVE the problematic annotation line
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at      = Column(DateTime, onupdate=datetime.utcnow)

    # profile / extras
    full_name           = Column(String)
    avatar_url          = Column(String)
    phone_number        = Column(String)
    department          = Column(String)
    about_me            = Column(Text)
    preferred_language  = Column(String, default="en")
    can_assign_tasks    = Column(Boolean, default=False, nullable=False)

    # relationships
    company = relationship("Company", back_populates="users")

    # Tasks that this user is assigned to (needs to complete)
    allocated_tasks = relationship(
        "Task",
        back_populates="assignee",
        foreign_keys="Task.assigned_to_id"
    )

    # Tasks that this user has assigned/delegated to others
    assigned_tasks = relationship(
        "Task",
        back_populates="creator",
        foreign_keys="Task.created_by_id"
    )

# ---------- TASK --------------------------------------------------
class Task(Base):
    __tablename__ = "tasks"

    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String, nullable=False)
    description    = Column(String)
    status         = Column(SqlaEnum(TaskStatus), default=TaskStatus.PENDING)
    assigned_to_id = Column(Integer, ForeignKey("users.id"))
    created_by_id  = Column(Integer, ForeignKey("users.id"))
    company_id     = Column(Integer, ForeignKey("companies.id"))
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    due_date       = Column(DateTime)
    completed_at = Column(DateTime, nullable=True)


    # relationships
    company = relationship("Company", back_populates="tasks")
    
    # The person who needs to do this task
    assignee = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        back_populates="allocated_tasks"
    )
    
    # The person who created/assigned the task
    creator = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="assigned_tasks"
    )
