from app.database import SessionLocal, engine, Base
from app.models import User, Company, UserRole
from app.auth import get_password_hash

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
            hashed_password=get_password_hash("superadmin123"),
            role=UserRole.SUPER_ADMIN,
            full_name="Super Admin",
            avatar_url="https://ui-avatars.com/api/?name=Super+Admin",
            phone_number="+1234567890",
            department="Platform",
            about_me="I manage the entire platform."
        )
        db.add(super_admin)

        # 2. A sample company
        sample_co = Company(
            name="TaskFlow Inc.",
            description="Task management for modern teams.",
            is_active=True,
        )
        db.add(sample_co)
        db.flush()           # so sample_co.id is available without commit

        # 3. Company admin
        company_admin = User(
            email="companyadmin@test.com",
            username="companyadmin",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            company_id=sample_co.id,
            full_name="Company Admin",
            avatar_url="https://ui-avatars.com/api/?name=Company+Admin",
            phone_number="+1987654321",
            department="Management",
            about_me="I manage this company.",
            can_assign_tasks=True,
        )
        db.add(company_admin)

        # 4. Regular company user
        regular_user = User(
            email="user@test.com",
            username="testuser",
            hashed_password=get_password_hash("user123"),
            role=UserRole.USER,
            company_id=sample_co.id,
            full_name="Test User",
            avatar_url="https://ui-avatars.com/api/?name=Test+User",
            phone_number="+1122334455",
            department="Engineering",
            about_me="I help build the future.",
        )
        db.add(regular_user)

        db.commit()
        print("✅ Sample data inserted successfully!")

    except Exception as exc:
        db.rollback()
        print("❌ Seed failed:", exc)
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
