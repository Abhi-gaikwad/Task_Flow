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
    is_active   = Column(Boolean, default=True,  nullable=False)

    # relationships
    users = relationship("User", back_populates="company")
    tasks = relationship("Task", back_populates="company")


# ---------- USER --------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String,  unique=True, nullable=False)
    username        = Column(String,  unique=True, nullable=False)
    hashed_password = Column(String,               nullable=False)
    role            = Column(SqlaEnum(UserRole), default=UserRole.USER, nullable=False)

    company_id      = Column(Integer, ForeignKey("companies.id"))
    is_active       = Column(Boolean, default=True, nullable=False)
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
    
    # Tasks allocated TO this user (tasks they need to complete)
    allocated_tasks = relationship("Task", back_populates="assignee",
                                  foreign_keys="Task.assigned_to_id")
    
    # Tasks assigned BY this user (tasks they created/assigned to others)
    assigned_tasks = relationship("Task", back_populates="creator",
                                 foreign_keys="Task.created_by_id")

# ---------- TASK --------------------------------------------------
class Task(Base):
    __tablename__ = "tasks"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    description = Column(Text)

    status      = Column(SqlaEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)

    company_id  = Column(Integer, ForeignKey("companies.id"),           nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"),               nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_by  = Column(Integer, ForeignKey("users.id"),               nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"),               nullable=False)


    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, onupdate=datetime.utcnow)
    due_date    = Column(DateTime)

    # relationships
    company  = relationship("Company", back_populates="tasks")
    assignee = relationship("User",    back_populates="assigned_tasks",
                            foreign_keys=[assigned_to])
    creator  = relationship("User",    back_populates="created_tasks",
                            foreign_keys=[created_by])
