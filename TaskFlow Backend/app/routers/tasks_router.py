from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.auth import get_current_user
from app.models import User, Task, UserRole, TaskStatus, NotificationType
from app.schemas import TaskCreate, TaskUpdate, TaskResponse
from app.database import get_db
from .notifications_router import create_notification  # Adapt import as needed

router = APIRouter()

# ---------------------------
# Utility: Map virtual admin to real admin's positive user ID
# ---------------------------
def resolve_creator_id(current_user: User, db: Session) -> tuple[int, str]:
    # If user is virtual (company admin, negative ID), resolve to real admin
    if current_user.id < 0:
        company_admin = db.query(User).filter(
            User.company_id == current_user.company_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).first()
        if not company_admin:
            raise HTTPException(
                status_code=500,
                detail="No real admin user found for company."
            )
        return company_admin.id, company_admin.username
    else:
        return current_user.id, current_user.username

# ---------------------------
# Create Task
# ---------------------------
@router.post("/tasks", response_model=TaskResponse)
def allocate_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == UserRole.USER and not getattr(current_user, "can_assign_tasks", False):
        raise HTTPException(status_code=403, detail="You don't have permission to assign tasks")
    assignee = db.get(User, task_data.assigned_to_id)
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    if current_user.role != UserRole.SUPER_ADMIN:
        if assignee.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot assign tasks to users from other companies")

    # THIS IS THE FIX: If company admin is virtual (negative id), resolve to real admin!
    if current_user.id < 0:
        company_admin = db.query(User).filter(
            User.company_id == current_user.company_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).first()
        if not company_admin:
            raise HTTPException(status_code=500, detail="No real admin user found for company")
        created_by_id = company_admin.id
        creator_name = company_admin.username
    else:
        created_by_id = current_user.id
        creator_name = current_user.username

    task = Task(
        title=task_data.title,
        description=task_data.description,
        assigned_to_id=task_data.assigned_to_id,
        created_by=created_by_id,    # Always a real existing user id for FK!
        company_id=assignee.company_id,
        due_date=task_data.due_date,
        priority=task_data.priority,
        status=TaskStatus.PENDING
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    task_response = TaskResponse.model_validate(task)
    task_response.assignee_name = assignee.username
    task_response.creator_name = creator_name
    create_notification(
        db=db,
        user_id=assignee.id,
        notification_type=NotificationType.TASK_ASSIGNED,
        title="New Task Assigned",
        message=f"You have been assigned a new task: {task.title}",
        task_id=task.id
    )
    return task_response

# ---------------------------
# Get My Tasks
# ---------------------------
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
    task_responses = []
    for task in tasks:
        task_response = TaskResponse.model_validate(task)
        creator = db.get(User, task.created_by)
        task_response.creator_name = creator.username if creator else "Unknown"
        task_response.assignee_name = current_user.username
        task_responses.append(task_response)
    return task_responses

# ---------------------------
# Update Task Status
# ---------------------------
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
    elif current_user.role == UserRole.ADMIN:
        if task.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    old_status = task.status
    task.status = status
    if status == TaskStatus.COMPLETED:
        task.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    if old_status != status:
        creator = db.get(User, task.created_by)
        if creator and creator.id != current_user.id:
            create_notification(
                db=db,
                user_id=creator.id,
                notification_type=NotificationType.TASK_STATUS_UPDATED,
                title="Task Status Updated",
                message=f"Task '{task.title}' status updated to {status.value} by {current_user.username}",
                task_id=task.id
            )
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    return task_response

# ---------------------------
# Update Task (full)
# ---------------------------
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
    can_update = False
    if current_user.role == UserRole.SUPER_ADMIN:
        can_update = True
    elif current_user.role == UserRole.ADMIN and task.company_id == current_user.company_id:
        can_update = True
    elif task.created_by == current_user.id:
        can_update = True
    if not can_update:
        raise HTTPException(status_code=403, detail="You don't have permission to update this task")
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    if task_update.status == TaskStatus.COMPLETED and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    return task_response

# ---------------------------
# List All Tasks (admin queries all company, users see own)
# ---------------------------
@router.get("/tasks", response_model=List[TaskResponse])
def list_all_tasks(
    status: Optional[TaskStatus] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    created_by: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if current_user.role == UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(Task.company_id == current_user.company_id)
    else:
        query = query.filter(
            (Task.assigned_to_id == current_user.id) |
            (Task.created_by == current_user.id)
        )
    if status:
        query = query.filter(Task.status == status)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if created_by:
        query = query.filter(Task.created_by == created_by)
    tasks = query.offset(skip).limit(limit).all()
    task_responses = []
    for task in tasks:
        task_response = TaskResponse.model_validate(task)
        assignee = db.get(User, task.assigned_to_id)
        creator = db.get(User, task.created_by)
        task_response.assignee_name = assignee.username if assignee else "Unknown"
        task_response.creator_name = creator.username if creator else "Unknown"
        task_responses.append(task_response)
    return task_responses