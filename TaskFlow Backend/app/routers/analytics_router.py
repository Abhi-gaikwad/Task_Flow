from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Task, TaskStatus, TaskPriority
# If your Company model is named differently, adjust this import:
from app.models import Company  # <-- ensure this exists

router = APIRouter(prefix="/analytics", tags=["analytics"])

def _status_counts(q, db: Session):
    rows = (
        db.query(Task.status, func.count(Task.id))
        .select_from(q.subquery())     # group over the scoped subquery
        .group_by(Task.status)
        .all()
    )
    m = {str(status.value if hasattr(status, "value") else status): count for status, count in rows}
    return {
        "total_tasks": sum(m.values()),
        "pending_tasks": m.get("pending", 0),
        "in_progress_tasks": m.get("in_progress", 0),
        "completed_tasks": m.get("completed", 0),
    }

def _priority_counts(q, db: Session):
    rows = (
        db.query(Task.priority, func.count(Task.id))
        .select_from(q.subquery())
        .group_by(Task.priority)
        .all()
    )
    return {str(p.value if hasattr(p, "value") else p): c for p, c in rows}

def _avg_completion_hours(q, db: Session):
    avg_hours = (
        db.query(
            func.avg(
                func.extract("epoch", Task.completed_at - Task.created_at) / 3600.0
            )
        )
        .select_from(q.subquery())
        .filter(Task.completed_at.isnot(None))
        .scalar()
    )
    return float(avg_hours or 0)

def _get_overdue_tasks(q, db: Session, now):
    return (
        q.filter(
            Task.due_date.isnot(None),
            Task.due_date < now,
            Task.status != TaskStatus.COMPLETED
        ).count()
    )

def _get_upcoming_tasks(q, db: Session, now):
    return (
        q.filter(
            Task.due_date.isnot(None),
            Task.due_date >= now,
            Task.due_date <= now + timedelta(days=7),
            Task.status != TaskStatus.COMPLETED
        ).count()
    )

@router.get("")
def get_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    seven_days = now - timedelta(days=7)

    role = current_user.role
    base_task_q = db.query(Task)  # will scope per role below

    # ---------- SUPER ADMIN (global) ----------
    if role == "super_admin":
        scoped_tasks = base_task_q  # no scope
        status_counts = _status_counts(scoped_tasks, db)
        priority = _priority_counts(scoped_tasks, db)
        
        overdue_tasks = _get_overdue_tasks(scoped_tasks, db, now)
        upcoming_tasks = _get_upcoming_tasks(scoped_tasks, db, now)
        avg_completion = _avg_completion_hours(scoped_tasks, db)

        total_users = db.query(User).count()
        active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
        inactive_users = total_users - active_users

        total_companies = db.query(Company).count()

        tasks_created_last_7 = db.query(Task).filter(Task.created_at >= seven_days).count()
        tasks_completed_last_7 = (
            db.query(Task)
            .filter(Task.status == TaskStatus.COMPLETED, Task.completed_at >= seven_days)
            .count()
        )

        return {
            "scope": "global",
            "role": role,
            "totals": {
                "total_companies": total_companies,
                "total_users": total_users,
                "active_users": active_users,
                "inactive_users": inactive_users,
                "total_tasks": status_counts["total_tasks"],
                "pending_tasks": status_counts["pending_tasks"],
                "in_progress_tasks": status_counts["in_progress_tasks"],
                "completed_tasks": status_counts["completed_tasks"],
                "overdue_tasks": overdue_tasks,
                "upcoming_tasks": upcoming_tasks,
            },
            "priority_summary": priority,
            "average_completion_time_hours": avg_completion,
            "recent_activity": {
                "tasks_created_last_7_days": tasks_created_last_7,
                "tasks_completed_last_7_days": tasks_completed_last_7,
            },
        }

    # ---------- COMPANY / ADMIN (company-scoped) ----------
    if role in ("company", "admin"):
        company_id = current_user.company_id
        if not company_id:
            # Fallback: return empty analytics if no company_id
            return {
                "scope": "company",
                "role": role,
                "company_id": None,
                "totals": {
                    "total_users": 0,
                    "active_users": 0,
                    "inactive_users": 0,
                    "total_tasks": 0,
                    "pending_tasks": 0,
                    "in_progress_tasks": 0,
                    "completed_tasks": 0,
                    "overdue_tasks": 0,
                    "upcoming_tasks": 0,
                },
                "priority_summary": {},
                "average_completion_time_hours": 0,
                "recent_activity": {
                    "tasks_created_last_7_days": 0,
                    "tasks_completed_last_7_days": 0,
                },
            }
        
        # Scope tasks to company
        scoped_tasks = base_task_q.filter(Task.company_id == company_id)
        status_counts = _status_counts(scoped_tasks, db)
        priority = _priority_counts(scoped_tasks, db)

        overdue_tasks = _get_overdue_tasks(scoped_tasks, db, now)
        upcoming_tasks = _get_upcoming_tasks(scoped_tasks, db, now)
        avg_completion = _avg_completion_hours(scoped_tasks, db)

        # Get company users
        total_users = db.query(func.count(User.id)).filter(User.company_id == company_id).scalar() or 0
        active_users = db.query(func.count(User.id)).filter(
            User.company_id == company_id, 
            User.is_active == True
        ).scalar() or 0
        inactive_users = total_users - active_users

        # Get company-scoped task activity
        tasks_created_last_7 = scoped_tasks.filter(Task.created_at >= seven_days).count()
        tasks_completed_last_7 = scoped_tasks.filter(
            Task.status == TaskStatus.COMPLETED, 
            Task.completed_at >= seven_days
        ).count()

        return {
            "scope": "company",
            "role": role,
            "company_id": company_id,
            "totals": {
                "total_users": total_users,
                "active_users": active_users,
                "inactive_users": inactive_users,
                "total_tasks": status_counts["total_tasks"],
                "pending_tasks": status_counts["pending_tasks"],
                "in_progress_tasks": status_counts["in_progress_tasks"],
                "completed_tasks": status_counts["completed_tasks"],
                "overdue_tasks": overdue_tasks,
                "upcoming_tasks": upcoming_tasks,
            },
            "priority_summary": priority,
            "average_completion_time_hours": avg_completion,
            "recent_activity": {
                "tasks_created_last_7_days": tasks_created_last_7,
                "tasks_completed_last_7_days": tasks_completed_last_7,
            },
        }

    # ---------- USER (self-scoped) ----------
    # Get tasks assigned to user + tasks created by user (if they have permission to create)
    user_assigned_tasks = base_task_q.filter(Task.assigned_to_id == current_user.id)
    
    # If user has permissions to create tasks, also include tasks they created
    # You might need to adjust this based on your permission system
    user_has_create_permission = hasattr(current_user, 'can_create_tasks') and current_user.can_create_tasks
    # Alternative: check role-based permissions
    # user_has_create_permission = role in ('admin', 'company', 'team_lead')  # adjust as needed
    
    if user_has_create_permission:
        # Include both assigned tasks and created tasks
        user_created_tasks = base_task_q.filter(Task.created_by == current_user.id)
        # Combine the queries (union of assigned and created tasks)
        scoped_tasks = base_task_q.filter(
            (Task.assigned_to_id == current_user.id) | 
            (Task.created_by == current_user.id)
        )
    else:
        # Only assigned tasks
        scoped_tasks = user_assigned_tasks

    status_counts = _status_counts(scoped_tasks, db)
    priority = _priority_counts(scoped_tasks, db)

    overdue_tasks = _get_overdue_tasks(scoped_tasks, db, now)
    upcoming_tasks = _get_upcoming_tasks(scoped_tasks, db, now)
    avg_completion = _avg_completion_hours(scoped_tasks, db)

    # For users, we count tasks they created vs tasks they completed
    if user_has_create_permission:
        tasks_created_last_7 = db.query(Task).filter(
            Task.created_by == current_user.id,
            Task.created_at >= seven_days,
        ).count()
    else:
        tasks_created_last_7 = 0
        
    tasks_completed_last_7 = user_assigned_tasks.filter(
        Task.status == TaskStatus.COMPLETED,
        Task.completed_at >= seven_days,
    ).count()

    return {
        "scope": "user",
        "role": role,
        "user_id": current_user.id,
        "totals": {
            "total_tasks": status_counts["total_tasks"],
            "pending_tasks": status_counts["pending_tasks"],
            "in_progress_tasks": status_counts["in_progress_tasks"],
            "completed_tasks": status_counts["completed_tasks"],
            "overdue_tasks": overdue_tasks,
            "upcoming_tasks": upcoming_tasks,
        },
        "priority_summary": priority,
        "average_completion_time_hours": avg_completion,
        "recent_activity": {
            "tasks_created_last_7_days": tasks_created_last_7,
            "tasks_completed_last_7_days": tasks_completed_last_7,
        },
    }