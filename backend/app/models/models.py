from sqlalchemy import Column, String, Float, DateTime, Enum, ForeignKey
import uuid
from datetime import datetime, timedelta, timezone
from ..database import Base

# Define Thailand timezone (GMT+7)
THAILAND_TZ = timezone(timedelta(hours=7))

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    google_id = Column(String, nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    type = Column(Enum('income', 'expense', name='transaction_type'))
    amount = Column(Float)
    category = Column(String)
    note = Column(String, nullable=True)
    # Store timestamps as timezone-aware UTC by default
    date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
