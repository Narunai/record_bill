from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TransactionType(str, Enum):
    income = "income"
    expense = "expense"

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class TransactionBase(BaseModel):
    type: TransactionType
    amount: float
    category: str
    note: Optional[str] = None
    date: Optional[datetime] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None

class Transaction(TransactionBase):
    id: str
    user_id: str
    date: datetime
    class Config:
        from_attributes = True

class FrequentCategory(BaseModel):
    category: str
    count: int

class SummaryResponse(BaseModel):
    total_income: float
    total_expense: float
    balance: float

class DailyExpense(BaseModel):
    date: str
    income: float
    expense: float
