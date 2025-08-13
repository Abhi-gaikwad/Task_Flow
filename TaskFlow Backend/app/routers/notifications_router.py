from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from app.auth import get_current_user
from app.models import Notification, NotificationType, User, UserRole
from app.schemas import NotificationResponse
from app.database import get_db

router = APIRouter()


# ---------------------------
# Utility: Resolve virtual → real user IDs
# ---------------------------
def resolve_real_user_id(db: Session, user_id: int) -> int:
    """
    If user_id is a virtual company user (negative ID),
    return the real admin for that company. Otherwise return original.
    """
    if user_id < 0:
        virtual_user = db.query(User).filter(User.id == user_id).first()
        if not virtual_user:
            raise HTTPException(status_code=404, detail="Virtual user not found")
        company_admin = db.query(User).filter(
            User.company_id == virtual_user.company_id,
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).first()
        if not company_admin:
            raise HTTPException(status_code=500, detail="No real admin found for company")
        return company_admin.id
    return user_id


# ---------------------------
# Get Notifications
# ---------------------------
@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ✅ Skip DB query for superadmin
    if current_user.id == -999:
        print("ℹ️ Superadmin detected — returning empty notifications list")
        return []

    # ✅ Skip DB query for company admin
    if current_user.role == UserRole.ADMIN:
        print(f"ℹ️ Company admin '{current_user.username}' detected — returning empty notifications list")
        return []

    real_user_id = resolve_real_user_id(db, current_user.id)

    notifications = db.query(Notification).filter(
        Notification.user_id == real_user_id
    ).order_by(Notification.created_at.desc()).all()

    # Normalize type to lowercase string for frontend
    for notif in notifications:
        if isinstance(notif.type, NotificationType):
            notif.type = notif.type.value.lower()
        elif isinstance(notif.type, str):
            notif.type = notif.type.lower()

    print(f"🔢 Fetched {len(notifications)} notifications for user_id={real_user_id}")
    return notifications


# ---------------------------
# Mark Notification as Read
# ---------------------------
@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Skip for superadmin
    if current_user.id == -999:
        print("ℹ️ Superadmin — skipping mark as read")
        return {"message": "No notifications for superadmin"}

    # Skip for company admin
    if current_user.role == UserRole.ADMIN:
        print("ℹ️ Company admin — skipping mark as read")
        return {"message": "No notifications for company admin"}

    real_user_id = resolve_real_user_id(db, current_user.id)

    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != real_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    notification.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


# ---------------------------
# Delete Notification
# ---------------------------
@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Skip for superadmin
    if current_user.id == -999:
        print("ℹ️ Superadmin — skipping delete notification")
        return {"message": "No notifications for superadmin"}

    # Skip for company admin
    if current_user.role == UserRole.ADMIN:
        print("ℹ️ Company admin — skipping delete notification")
        return {"message": "No notifications for company admin"}

    real_user_id = resolve_real_user_id(db, current_user.id)

    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != real_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}


# ---------------------------
# Create Notification
# ---------------------------
def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    task_id: Optional[int] = None
):
    # Skip creating notifications for superadmin
    if user_id == -999:
        print("ℹ️ Skipping notification creation for superadmin")
        return None

    # Skip creating notifications for company admin
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.role == UserRole.ADMIN:
        print("ℹ️ Skipping notification creation for company admin")
        return None

    real_user_id = resolve_real_user_id(db, user_id)

    notification = Notification(
        user_id=real_user_id,
        type=notification_type,
        title=title,
        message=message,
        task_id=task_id,
        created_at=datetime.utcnow(),
        is_read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    print(f"✅ Notification inserted for user_id={real_user_id}, title='{title}'")
    return notification


# ---------------------------
# Create Dual Notifications
# ---------------------------
def create_task_assignment_notifications(
    db: Session,
    creator_user_id: int,
    assigned_user_id: int,
    task_title: str,
    task_id: int,
    assigned_user_name: str = "User"
):
    notifications = []
    try:
        # Notification for the assigned user
        assigned_notification = create_notification(
            db=db,
            user_id=assigned_user_id,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="New Task Assigned",
            message=f"You have been assigned a new task: {task_title}",
            task_id=task_id
        )
        if assigned_notification:
            notifications.append(assigned_notification)
            print(f"✅ Task assignment notification created for assigned user {assigned_user_id}")

        # Notification for the creator (only if different)
        if creator_user_id != assigned_user_id:
            creator_notification = create_notification(
                db=db,
                user_id=creator_user_id,
                notification_type=NotificationType.TASK_STATUS_UPDATED,
                title="Task Created Successfully",
                message=f'Task "{task_title}" has been successfully assigned to {assigned_user_name}',
                task_id=task_id
            )
            if creator_notification:
                notifications.append(creator_notification)
                print(f"✅ Task creation confirmation notification created for creator {creator_user_id}")

        return tuple(notifications)

    except Exception as e:
        print(f"❌ Error creating task assignment notifications: {str(e)}")
        return tuple(notifications) if notifications else (None, None)


# ---------------------------
# Bulk Create Task Assignment Notifications
# ---------------------------
def create_bulk_task_assignment_notifications(
    db: Session,
    creator_user_id: int,
    assignments: List[dict],
    task_title: str
):
    results = {
        "assigned_user_notifications": [],
        "creator_notifications": [],
        "errors": []
    }

    try:
        for assignment in assignments:
            try:
                assigned_notification = create_notification(
                    db=db,
                    user_id=assignment["assigned_user_id"],
                    notification_type=NotificationType.TASK_ASSIGNED,
                    title="New Task Assigned",
                    message=f"You have been assigned a new task: {task_title}",
                    task_id=assignment["task_id"]
                )
                if assigned_notification:
                    results["assigned_user_notifications"].append(assigned_notification)

            except Exception as e:
                error_msg = f"Failed to create notification for assignment {assignment}: {str(e)}"
                print(f"❌ {error_msg}")
                results["errors"].append(error_msg)

        if results["assigned_user_notifications"] and creator_user_id not in [a["assigned_user_id"] for a in assignments]:
            try:
                creator_notification = create_notification(
                    db=db,
                    user_id=creator_user_id,
                    notification_type=NotificationType.TASK_STATUS_UPDATED,
                    title="Tasks Created Successfully",
                    message=f'Task "{task_title}" has been successfully assigned to {len(results["assigned_user_notifications"])} user(s)',
                    task_id=assignments[0]["task_id"] if assignments else None
                )
                if creator_notification:
                    results["creator_notifications"].append(creator_notification)

            except Exception as e:
                error_msg = f"Failed to create creator notification: {str(e)}"
                print(f"❌ {error_msg}")
                results["errors"].append(error_msg)

        print(f"✅ Bulk notifications created: {len(results['assigned_user_notifications'])} assigned, {len(results['creator_notifications'])} creator")
        return results

    except Exception as e:
        error_msg = f"Error in bulk notification creation: {str(e)}"
        print(f"❌ {error_msg}")
        results["errors"].append(error_msg)
        return results
