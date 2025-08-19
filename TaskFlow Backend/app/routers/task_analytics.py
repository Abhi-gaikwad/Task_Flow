from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Task, TaskStatus, TaskPriority

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # base query → tasks assigned to current user
    base_query = db.query(Task).filter(Task.assigned_to_id == current_user.id)

    total_tasks = base_query.count()
    completed_tasks = base_query.filter(
        Task.status == TaskStatus.COMPLETED).count()
    pending_tasks = base_query.filter(
        Task.status == TaskStatus.PENDING).count()
    in_progress_tasks = base_query.filter(
        Task.status == TaskStatus.IN_PROGRESS).count()
    overdue_tasks = base_query.filter(
        Task.due_date < datetime.utcnow(),
        Task.status != TaskStatus.COMPLETED
    ).count()

    # tasks created by this user
    created_tasks = db.query(Task).filter(
        Task.created_by == current_user.id).count()

    # upcoming tasks (next 7 days)
    upcoming_tasks = base_query.filter(
        Task.due_date >= datetime.utcnow(),
        Task.due_date <= datetime.utcnow() + timedelta(days=7),
        Task.status != TaskStatus.COMPLETED,
    ).count()

    # priority breakdown
    priority_counts = (
        db.query(Task.priority, func.count(Task.id))
        .filter(Task.assigned_to_id == current_user.id)
        .group_by(Task.priority)
        .all()
    )
    priority_summary = {
        priority.value: count for priority, count in priority_counts}

    # average completion time (in hours)
    avg_completion_time = (
        db.query(func.avg(func.extract(
            'epoch', Task.completed_at - Task.created_at) / 3600))
        .filter(Task.assigned_to_id == current_user.id)
        .filter(Task.completed_at.isnot(None))
        .scalar()
    )

    # recent activity
    tasks_created_last_7d = (
        db.query(Task).filter(
            Task.created_by == current_user.id,
            Task.created_at >= datetime.utcnow() - timedelta(days=7),
        ).count()
    )
    tasks_completed_last_7d = (
        base_query.filter(
            Task.status == TaskStatus.COMPLETED,
            Task.completed_at >= datetime.utcnow() - timedelta(days=7),
        ).count()
    )

    return {
        "user_id": current_user.id,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "in_progress_tasks": in_progress_tasks,
        "overdue_tasks": overdue_tasks,
        "upcoming_tasks": upcoming_tasks,
        "created_tasks": created_tasks,
        "priority_summary": priority_summary,
        "average_completion_time_hours": avg_completion_time or 0,
        "recent_activity": {
            "tasks_created_last_7_days": tasks_created_last_7d,
            "tasks_completed_last_7_days": tasks_completed_last_7d,
        }
    }
