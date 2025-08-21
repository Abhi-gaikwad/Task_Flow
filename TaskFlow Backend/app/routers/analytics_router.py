from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Task, TaskStatus, TaskPriority, Company

router = APIRouter(prefix="/analytics", tags=["analytics"])

def _status_counts(q, db: Session):
    """Calculate task status counts from a query"""
    rows = (
        q.with_entities(Task.status, func.count(Task.id))
        .group_by(Task.status)
        .all()
    )
    
    # Convert enum values to strings properly
    status_map = {}
    for status, count in rows:
        if hasattr(status, 'value'):
            status_map[status.value] = count
        else:
            status_map[str(status)] = count
    
    return {
        "total_tasks": sum(status_map.values()),
        "pending_tasks": status_map.get("pending", 0),
        "in_progress_tasks": status_map.get("in_progress", 0),
        "completed_tasks": status_map.get("completed", 0),
    }

def _priority_counts(q, db: Session):
    """Calculate task priority counts from a query"""
    rows = (
        q.with_entities(Task.priority, func.count(Task.id))
        .group_by(Task.priority)
        .all()
    )
    
    priority_map = {}
    for priority, count in rows:
        if hasattr(priority, 'value'):
            priority_map[priority.value] = count
        else:
            priority_map[str(priority)] = count
    
    return priority_map

def _avg_completion_hours(q, db: Session):
    """Calculate average completion time in hours"""
    avg_hours = (
        q.filter(Task.completed_at.isnot(None))
        .with_entities(
            func.avg(
                func.extract("epoch", Task.completed_at - Task.created_at) / 3600.0
            )
        )
        .scalar()
    )
    return float(avg_hours or 0)

def _get_overdue_tasks(q, db: Session, now):
    """Count overdue tasks"""
    return (
        q.filter(
            Task.due_date.isnot(None),
            Task.due_date < now,
            Task.status != TaskStatus.COMPLETED
        ).count()
    )

def _get_upcoming_tasks(q, db: Session, now):
    """Count upcoming tasks (due within 7 days)"""
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
    seven_days_ago = now - timedelta(days=7)

    # Get role as string
    role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    
    print(f"User role: {role}, User ID: {current_user.id}, Company ID: {current_user.company_id}")

    # ---------- SUPER ADMIN (global analytics) ----------
    if role == "super_admin":
        print("Processing super_admin analytics...")
        
        try:
            # Get all tasks across all companies
            all_tasks_q = db.query(Task)
            total_task_count = all_tasks_q.count()
            print(f"Total tasks in DB: {total_task_count}")
            
            if total_task_count == 0:
                print("No tasks found in database")
            
            status_counts = _status_counts(all_tasks_q, db)
            priority_counts = _priority_counts(all_tasks_q, db)
            
            # Calculate task metrics
            overdue_tasks = _get_overdue_tasks(all_tasks_q, db, now)
            upcoming_tasks = _get_upcoming_tasks(all_tasks_q, db, now)
            avg_completion = _avg_completion_hours(all_tasks_q, db)

            # Get user stats across all companies
            total_users = db.query(User).count()
            active_users = db.query(User).filter(User.is_active == True).count()
            inactive_users = total_users - active_users
            
            print(f"User stats - Total: {total_users}, Active: {active_users}")

            # Get company stats
            total_companies = db.query(Company).count()
            active_companies = db.query(Company).filter(Company.is_active == True).count()
            
            print(f"Company stats - Total: {total_companies}, Active: {active_companies}")

            # Get recent activity
            tasks_created_last_7 = all_tasks_q.filter(Task.created_at >= seven_days_ago).count()
            tasks_completed_last_7 = all_tasks_q.filter(
                Task.status == TaskStatus.COMPLETED,
                Task.completed_at >= seven_days_ago
            ).count()

            result = {
                "scope": "global",
                "role": role,
                "totals": {
                    "total_companies": total_companies,
                    "active_companies": active_companies,
                    "total_users": total_users,
                    "active_users": active_users,
                    "inactive_users": inactive_users,
                    **status_counts,
                    "overdue_tasks": overdue_tasks,
                    "upcoming_tasks": upcoming_tasks,
                },
                "priority_summary": priority_counts,
                "average_completion_time_hours": round(avg_completion, 2),
                "recent_activity": {
                    "tasks_created_last_7_days": tasks_created_last_7,
                    "tasks_completed_last_7_days": tasks_completed_last_7,
                },
            }
            
            print(f"Super admin result: {result}")
            return result
            
        except Exception as e:
            print(f"Error in super_admin analytics: {e}")
            import traceback
            traceback.print_exc()
            raise

    # ---------- COMPANY ADMIN (company-scoped analytics) ----------
    elif role in ("company", "admin"):
        print(f"Processing {role} analytics...")
        
        company_id = current_user.company_id
        print(f"Company ID: {company_id}")
        
        if not company_id:
            print("No company_id found for user")
            # Return empty analytics but don't error out
            return {
                "scope": "company",
                "role": role,
                "company_id": None,
                "error": "User not associated with any company",
                # ... rest of empty response
            }
        
        try:
            # Get company info
            company = db.query(Company).filter(Company.id == company_id).first()
            print(f"Company found: {company.name if company else 'None'}")
            
            # Scope tasks to this company only
            company_tasks_q = db.query(Task).filter(Task.company_id == company_id)
            company_task_count = company_tasks_q.count()
            print(f"Company tasks count: {company_task_count}")
            
            status_counts = _status_counts(company_tasks_q, db)
            priority_counts = _priority_counts(company_tasks_q, db)

            # Calculate task metrics for company
            overdue_tasks = _get_overdue_tasks(company_tasks_q, db, now)
            upcoming_tasks = _get_upcoming_tasks(company_tasks_q, db, now)
            avg_completion = _avg_completion_hours(company_tasks_q, db)

            # Get company user stats
            company_users_q = db.query(User).filter(User.company_id == company_id)
            total_users = company_users_q.count()
            active_users = company_users_q.filter(User.is_active == True).count()
            inactive_users = total_users - active_users
            
            print(f"Company users - Total: {total_users}, Active: {active_users}")

            # Get company-scoped recent activity
            tasks_created_last_7 = company_tasks_q.filter(Task.created_at >= seven_days_ago).count()
            tasks_completed_last_7 = company_tasks_q.filter(
                Task.status == TaskStatus.COMPLETED,
                Task.completed_at >= seven_days_ago
            ).count()

            result = {
                "scope": "company",
                "role": role,
                "company_id": company_id,
                "company_name": company.name if company else "Unknown Company",
                "totals": {
                    "total_users": total_users,
                    "active_users": active_users,
                    "inactive_users": inactive_users,
                    **status_counts,
                    "overdue_tasks": overdue_tasks,
                    "upcoming_tasks": upcoming_tasks,
                },
                "priority_summary": priority_counts,
                "average_completion_time_hours": round(avg_completion, 2),
                "recent_activity": {
                    "tasks_created_last_7_days": tasks_created_last_7,
                    "tasks_completed_last_7_days": tasks_completed_last_7,
                },
            }
            
            print(f"Company/admin result: {result}")
            return result
            
        except Exception as e:
            print(f"Error in company analytics: {e}")
            import traceback
            traceback.print_exc()
            raise



    # ---------- REGULAR USER (personal analytics) ----------
    # ---------- USER (user-scoped analytics) ----------
    else:  # role == "user"
        print(f"Processing user analytics for user_id: {current_user.id}")
        
        try:
            # Check if user has permission to create/assign tasks
            user_can_create_tasks = (
                hasattr(current_user, 'can_assign_tasks') and current_user.can_assign_tasks
            ) or current_user.role in ['admin', 'company']  # Admins can always create tasks
            
            print(f"User can create tasks: {user_can_create_tasks}")
            
            # Get tasks assigned TO this user
            assigned_to_me_q = db.query(Task).filter(Task.assigned_to_id == current_user.id)
            assigned_to_me_count = assigned_to_me_q.count()
            
            # Get tasks assigned BY this user (if they have permission)
            assigned_by_me_count = 0
            assigned_by_me_q = None
            if user_can_create_tasks:
                assigned_by_me_q = db.query(Task).filter(Task.created_by == current_user.id)
                assigned_by_me_count = assigned_by_me_q.count()
            
            print(f"Tasks assigned to me: {assigned_to_me_count}")
            print(f"Tasks assigned by me: {assigned_by_me_count}")
            
            # For users with create permission, show combined view
            if user_can_create_tasks:
                # All tasks user is involved with (assigned to OR created by)
                all_user_tasks_q = db.query(Task).filter(
                    (Task.assigned_to_id == current_user.id) | 
                    (Task.created_by == current_user.id)
                )
            else:
                # Only tasks assigned to user
                all_user_tasks_q = assigned_to_me_q

            # Calculate overall stats
            status_counts = _status_counts(all_user_tasks_q, db)
            priority_counts = _priority_counts(all_user_tasks_q, db)
            overdue_tasks = _get_overdue_tasks(all_user_tasks_q, db, now)
            upcoming_tasks = _get_upcoming_tasks(all_user_tasks_q, db, now)
            avg_completion = _avg_completion_hours(all_user_tasks_q, db)

            # Calculate separate stats for assigned TO me
            assigned_to_me_status = _status_counts(assigned_to_me_q, db)
            assigned_to_me_overdue = _get_overdue_tasks(assigned_to_me_q, db, now)
            assigned_to_me_upcoming = _get_upcoming_tasks(assigned_to_me_q, db, now)

            # Calculate separate stats for assigned BY me (if applicable)
            assigned_by_me_status = {"total_tasks": 0, "pending_tasks": 0, "in_progress_tasks": 0, "completed_tasks": 0}
            assigned_by_me_overdue = 0
            assigned_by_me_upcoming = 0
            
            if user_can_create_tasks and assigned_by_me_q:
                assigned_by_me_status = _status_counts(assigned_by_me_q, db)
                assigned_by_me_overdue = _get_overdue_tasks(assigned_by_me_q, db, now)
                assigned_by_me_upcoming = _get_upcoming_tasks(assigned_by_me_q, db, now)

            # Get recent activity
            tasks_assigned_to_me_last_7 = assigned_to_me_q.filter(
                Task.created_at >= seven_days_ago
            ).count()
            
            tasks_completed_by_me_last_7 = assigned_to_me_q.filter(
                Task.status == TaskStatus.COMPLETED,
                Task.completed_at >= seven_days_ago
            ).count()

            tasks_created_by_me_last_7 = 0
            if user_can_create_tasks and assigned_by_me_q:
                tasks_created_by_me_last_7 = assigned_by_me_q.filter(
                    Task.created_at >= seven_days_ago
                ).count()

            result = {
                "scope": "user",
                "role": role,
                "user_id": current_user.id,
                "company_id": current_user.company_id,
                "can_create_tasks": user_can_create_tasks,
                "totals": {
                    **status_counts,
                    "overdue_tasks": overdue_tasks,
                    "upcoming_tasks": upcoming_tasks,
                },
                "assigned_to_me": {
                    **assigned_to_me_status,
                    "overdue_tasks": assigned_to_me_overdue,
                    "upcoming_tasks": assigned_to_me_upcoming,
                },
                "assigned_by_me": {
                    **assigned_by_me_status,
                    "overdue_tasks": assigned_by_me_overdue,
                    "upcoming_tasks": assigned_by_me_upcoming,
                } if user_can_create_tasks else None,
                "priority_summary": priority_counts,
                "average_completion_time_hours": round(avg_completion, 2),
                "recent_activity": {
                    "tasks_assigned_to_me_last_7_days": tasks_assigned_to_me_last_7,
                    "tasks_created_by_me_last_7_days": tasks_created_by_me_last_7,
                    "tasks_completed_by_me_last_7_days": tasks_completed_by_me_last_7,
                },
            }
            
            print(f"User result: {result}")
            return result
            
        except Exception as e:
            print(f"Error in user analytics: {e}")
            import traceback
            traceback.print_exc()
            raise