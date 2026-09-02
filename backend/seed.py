from app.database import Base, engine, SessionLocal
from app.models import User
from app.security import hash_password


Base.metadata.create_all(
    bind=engine
)


db = SessionLocal()


demo_users = [
    {
        "name": "Demo ASHA",
        "phone": "9000000001",
        "password": "asha12345",
        "role": "ASHA",
        "village": "Rampur",
    },
    {
        "name": "Demo ANM",
        "phone": "9000000002",
        "password": "anm12345",
        "role": "ANM",
        "village": "Rampur",
    },
    {
        "name": "Demo PHC",
        "phone": "9000000003",
        "password": "phc12345",
        "role": "PHC",
        "village": "Rampur",
    },
]


for item in demo_users:

    existing = (
        db.query(User)
        .filter(
            User.phone
            == item["phone"]
        )
        .first()
    )

    if existing:

        print(
            f"{item['role']} already exists"
        )

        continue

    user = User(
        name=item["name"],
        phone=item["phone"],
        password_hash=hash_password(
            item["password"]
        ),
        role=item["role"],
        village=item["village"],
    )

    db.add(user)

    print(
        f"Created {item['role']}"
    )


db.commit()

db.close()

print("Demo users ready.")