from app.database import SessionLocal, engine, Base
from app.models import User, UserRole
from app.security import get_password_hash  # make sure you have this file!

def init_db() -> None:
    """Create tables (if not present) and insert sample data exactly once."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # does a super-admin already exist?
        if db.query(User).filter(User.role == UserRole.SUPER_ADMIN).first():
            print("✅ Database already initialized – no changes made.")
            return

        print("🌱  Seeding initial data ...")

        # 1. Super-admin (global platform owner)
        super_admin = User(
            email="superadmin@test.com",
            username="superadmin",
            hashed_password=get_password_hash("123"),  # 🔒 hash password
            role=UserRole.SUPER_ADMIN,
            full_name="Super Admin",
            avatar_url="https://ui-avatars.com/api/?name=Super+Admin",
            phone_number="+1234567890",
            department="Platform",
            about_me="I manage the entire platform."
        )
        db.add(super_admin)
        db.commit()
        db.refresh(super_admin)

        print("✅ Super-admin created:", super_admin.email)

    finally:
        db.close()


if __name__ == "__main__":
    init_db()
