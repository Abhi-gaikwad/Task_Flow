from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.auth import get_current_user
from app.models import User, Task, UserRole, TaskStatus, NotificationType
from app.schemas import TaskCreate, TaskUpdate, TaskResponse, BulkTaskCreate, BulkTaskResponse
from app.database import get_db
from .notifications_router import create_notification
from datetime import date, timedelta, datetime


router = APIRouter()

# ---------------------------
# Resolve Creator
# ---------------------------


def resolve_creator_id(current_user: User, db: Session) -> tuple[int, str]:
    """Resolve creator ID for virtual admins (COMPANY role) and real users"""
    if current_user.id < 0:
        company_admin = db.query(User).filter(
            User.company_id == current_user.company_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).first()
        if not company_admin:
            raise HTTPException(
                status_code=500, detail="No real admin user found for company.")
        return company_admin.id, company_admin.username
    return current_user.id, current_user.username

# ---------------------------
# ✅ Get My Tasks (Tasks assigned to current user)
# ---------------------------


@router.get("/my-tasks", response_model=List[TaskResponse])
def get_my_tasks(
    status: Optional[TaskStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all tasks assigned to the current logged-in user."""
    query = db.query(Task).filter(Task.assigned_to_id == current_user.id)

    if status:
        query = query.filter(Task.status == status)

    tasks = query.order_by(Task.created_at.desc()).offset(
        skip).limit(limit).all()

    task_responses = []
    for task in tasks:
        task_data = TaskResponse.model_validate(task)
        assignee = db.get(User, task.assigned_to_id)
        creator = db.get(User, task.created_by)
        task_data.assignee_name = assignee.username if assignee else "Unknown"
        task_data.creator_name = creator.username if creator else "Unknown"
        # Ensure due_date is properly included
        task_data.due_date = task.due_date
        task_responses.append(task_data)

    return task_responses

# ---------------------------
# ✅ List All Tasks (Role-based permissions)
# ---------------------------


@router.get("/tasks", response_model=List[TaskResponse])
def list_all_tasks(
    status: Optional[TaskStatus] = Query(None),
    assigned_to_id: Optional[int] = Query(None),
    created_by: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    due_date: Optional[date] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)

):
    """
    Get all tasks based on user role:
    - Super Admin: Can see all tasks
    - Admin: Can see all tasks in their company
    - User: Can see tasks assigned to them OR tasks they created
    """
    query = db.query(Task)

    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admin can see all tasks
        pass
    elif current_user.role == UserRole.ADMIN:
        # Admin can see all tasks in their company
        query = query.filter(Task.company_id == current_user.company_id)
    else:  # User role
        # Users can see tasks assigned to them OR tasks they created
        query = query.filter(
            ((Task.assigned_to_id == current_user.id) |
             (Task.created_by == current_user.id)) &
            (Task.company_id == current_user.company_id)
        )

    # Apply filters
    if status:
        query = query.filter(Task.status == status)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if created_by:
        query = query.filter(Task.created_by == created_by)
    if search:
        query = query.filter(Task.title.ilike(
            f"%{search}%") | Task.description.ilike(f"%{search}"))

    # filter by date range (assume Task has created_at column)

    if start_date and end_date:
        query = query.filter(
            Task.created_at >= start_date,
            Task.created_at < (end_date + timedelta(days=1))
        )
    elif start_date:
        query = query.filter(Task.created_at >= start_date)
    elif end_date:
        query = query.filter(Task.created_at < (end_date + timedelta(days=1)))

    if due_date:
        query = query.filter(
            Task.due_date >= due_date,
            Task.due_date < (due_date + timedelta(days=1))
        )

    # Order by most recent first and apply pagination

    tasks = query.order_by(Task.created_at.desc()).offset(
        skip).limit(limit).all()

    # Build response with user names
    task_responses = []
    for task in tasks:
        task_response = TaskResponse.model_validate(task)
        assignee = db.get(User, task.assigned_to_id)
        creator = db.get(User, task.created_by)
        task_response.assignee_name = assignee.username if assignee else "Unknown"
        task_response.creator_name = creator.username if creator else "Unknown"
        task_responses.append(task_response)

    return task_responses

# ---------------------------
# ✅ Create Single Task
# ---------------------------


@router.post("/tasks", response_model=TaskResponse)
def allocate_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a single task and assign it to a user"""
    # Permission check for USER role: must have can_assign_tasks permission
    if current_user.role == UserRole.USER and not current_user.can_assign_tasks:
        raise HTTPException(
            status_code=403, detail="You don't have permission to assign tasks")

    # Verify assignee exists
    assignee = db.get(User, task_data.assigned_to_id)
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")

    # Ensure tasks are assigned within the same company, unless Super Admin
    if current_user.role != UserRole.SUPER_ADMIN:
        if assignee.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403, detail="Cannot assign tasks to users from other companies")

    # Resolve creator ID for virtual admins and real users
    created_by_id, creator_name = resolve_creator_id(current_user, db)

    # Create the task
    task = Task(
        title=task_data.title,
        description=task_data.description,
        assigned_to_id=task_data.assigned_to_id,
        created_by=created_by_id,
        company_id=assignee.company_id,
        due_date=task_data.due_date,
        priority=task_data.priority,
        status=TaskStatus.PENDING
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Build response with due date
    task_response = TaskResponse.model_validate(task)
    task_response.assignee_name = assignee.username
    task_response.creator_name = creator_name
    task_response.due_date = task.due_date

    # ✅ Notify the assignee
    if assignee and assignee.id:
        print(f"📢 Sending notification to assignee: {assignee.id} ({assignee.username})")
        create_notification(
            db=db,
            user_id=assignee.id,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="New Task Assigned",
            message=f'You have been assigned the task "{task.title}"',
            task_id=task.id
        )

    # ✅ Notify the creator (if different from assignee)
    if created_by_id and created_by_id != assignee.id:
        print(f"📢 Sending notification to creator: {created_by_id} ({creator_name})")
        create_notification(
            db=db,
            user_id=created_by_id,
            notification_type=NotificationType.TASK_CREATOR_ASSIGNED,  # ✅ new type
            title="Task Assigned",
            message=f'You assigned the task "{task.title}" to {assignee.username}',
            task_id=task.id
        )

    db.commit()
    return task_response

# ---------------------------
# ✅ Create Bulk Tasks
# ---------------------------


# tasks_router.py

# ---------------------------
# ✅ Create Bulk Tasks
# ---------------------------

@router.post("/tasks/bulk", response_model=BulkTaskResponse)
def create_bulk_tasks(
    task_data: BulkTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create multiple tasks with the same details but different assignees.
       Only the creator will receive ONE combined notification.
    """
    # Permission check
    if current_user.role == UserRole.USER and not current_user.can_assign_tasks:
        raise HTTPException(
            status_code=403, detail="You don't have permission to assign tasks")

    # Resolve creator ID
    created_by_id, creator_name = resolve_creator_id(current_user, db)
    successful = []
    failed = []
    assigned_usernames = []

    # Create tasks
    for user_id in task_data.assigned_to_ids:
        try:
            assignee = db.get(User, user_id)
            if not assignee:
                failed.append({"user_id": user_id, "error": "User not found"})
                continue

            if current_user.role != UserRole.SUPER_ADMIN:
                if assignee.company_id != current_user.company_id:
                    failed.append(
                        {"user_id": user_id, "error": "Cannot assign tasks to users from other companies"})
                    continue

            # Create task
            task = Task(
                title=task_data.title,
                description=task_data.description,
                assigned_to_id=user_id,
                created_by=created_by_id,
                company_id=assignee.company_id,
                due_date=task_data.due_date,
                priority=task_data.priority,
                status=TaskStatus.PENDING
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            # Collect usernames for one creator notification
            if user_id != created_by_id:
                assigned_usernames.append(assignee.username)

            # Build response
            task_response = TaskResponse.model_validate(task)
            task_response.assignee_name = assignee.username
            task_response.creator_name = creator_name
            task_response.due_date = task.due_date
            successful.append(task_response)

        except Exception as e:
            db.rollback()
            failed.append({"user_id": user_id, "error": str(e)})

    # ✅ Only send one combined notification to the creator
    try:
        if assigned_usernames and created_by_id not in task_data.assigned_to_ids:
            if len(assigned_usernames) == 1:
                usernames_str = assigned_usernames[0]
                title = "Task Assigned to User"
            elif len(assigned_usernames) == 2:
                usernames_str = f"{assigned_usernames[0]} and {assigned_usernames[1]}"
                title = "Task Assigned to Users"
            else:
                usernames_str = f"{', '.join(assigned_usernames[:-1])}, and {assigned_usernames[-1]}"
                title = "Task Assigned to Users"

            create_notification(
                db=db,
                user_id=created_by_id,
                notification_type=NotificationType.TASK_CREATOR_ASSIGNED,  # keep consistent
                title=title,
                message=f'You assigned the task "{task_data.title}" to {usernames_str}',
                task_id=successful[0].id if successful else None
            )

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error sending creator notification: {str(e)}")

    return BulkTaskResponse(
        success_count=len(successful),
        failure_count=len(failed),
        total_attempted=len(task_data.assigned_to_ids),
        successful_tasks=successful,
        failed_assignments=failed
    )


# ---------------------------
# ✅ Update Task Status
# ---------------------------


@router.put("/tasks/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status: TaskStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update task status - ENHANCED PERMISSIONS:
    1. Super Admin can update any task status
    2. Users can ONLY update status of tasks assigned TO them (not tasks they created)
    3. Admins can ONLY update status of tasks assigned TO them (not tasks they assigned to others)
    """
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Permission check
    can_update_status = False

    if current_user.role == UserRole.SUPER_ADMIN:
        can_update_status = True
    elif task.assigned_to_id == current_user.id:
        # User is assigned to this task - can update status
        can_update_status = True
    else:
        # User is not assigned to this task - cannot update status
        can_update_status = False

    if not can_update_status:
        raise HTTPException(
            status_code=403,
            detail="You can only update the status of tasks assigned to you"
        )

    # Update task status
    old_status = task.status
    task.status = status
    if status == TaskStatus.COMPLETED:
        task.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Notify task creator if status changed and they're not the one updating
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

    # Build response with due date
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    task_response.due_date = task.due_date
    return task_response

# ---------------------------
# ✅ Update Task (Full Update)
# ---------------------------


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Full task update - only creator, admins, or super admin can update"""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Permission check
    can_update = False
    if current_user.role == UserRole.SUPER_ADMIN:
        can_update = True
    elif current_user.role == UserRole.ADMIN and task.company_id == current_user.company_id:
        can_update = True
    elif task.created_by == current_user.id:
        # Allow the original creator to update the task
        can_update = True

    if not can_update:
        raise HTTPException(
            status_code=403, detail="You don't have permission to update this task")

    # Apply updates
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    if task_update.status == TaskStatus.COMPLETED and task.completed_at is None:
        task.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Build response with due date
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    task_response.due_date = task.due_date
    return task_response

# ---------------------------
# ✅ Get Single Task by ID
# ---------------------------


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task_by_id(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific task by ID with proper permissions"""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Permission check - same as list_all_tasks
    can_view = False
    if current_user.role == UserRole.SUPER_ADMIN:
        can_view = True
    elif current_user.role == UserRole.ADMIN and task.company_id == current_user.company_id:
        can_view = True
    elif task.assigned_to_id == current_user.id or task.created_by == current_user.id:
        can_view = True

    if not can_view:
        raise HTTPException(
            status_code=403, detail="You don't have permission to view this task")

    # Build response with due date
    task_response = TaskResponse.model_validate(task)
    assignee = db.get(User, task.assigned_to_id)
    creator = db.get(User, task.created_by)
    task_response.assignee_name = assignee.username if assignee else "Unknown"
    task_response.creator_name = creator.username if creator else "Unknown"
    task_response.due_date = task.due_date
    return task_response

# ---------------------------
# ✅ Delete Task
# ---------------------------


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete task - only super admin and admin can delete tasks"""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Permission check - only super admin and company admin can delete
    can_delete = False
    if current_user.role == UserRole.SUPER_ADMIN:
        can_delete = True
    elif current_user.role == UserRole.ADMIN and task.company_id == current_user.company_id:
        can_delete = True

    if not can_delete:
        raise HTTPException(
            status_code=403, detail="You don't have permission to delete this task")

    db.delete(task)
    db.commit()

    return {"message": "Task deleted successfully"}
