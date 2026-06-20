from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone
from ..database import get_db
from ..models import models
from ..schemas import schemas
from .auth import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.Transaction)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    data = transaction.dict()
    # Normalize date to UTC if provided
    if data.get('date') is not None:
        dt = data['date']
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        data['date'] = dt

    db_transaction = models.Transaction(
        **data,
        user_id=current_user.id
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.put("/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(
    transaction_id: str,
    transaction: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_transaction = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == current_user.id,
        )
        .first()
    )
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = transaction.dict(exclude_unset=True)
    # Normalize date to UTC if provided in update
    if 'date' in update_data and update_data['date'] is not None:
        dt = update_data['date']
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        update_data['date'] = dt

    for field, value in update_data.items():
        setattr(db_transaction, field, value)

    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_transaction = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == current_user.id,
        )
        .first()
    )
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(db_transaction)
    db.commit()
    return None

@router.get("/", response_model=List[schemas.Transaction])
def get_transactions(
    date: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    
    if date:
        try:
            target_date = datetime.strptime(date, '%Y-%m-%d').date()
            query = query.filter(func.date(models.Transaction.date) == target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if month and year:
        query = query.filter(
            func.extract('month', models.Transaction.date) == month,
            func.extract('year', models.Transaction.date) == year
        )
    elif year:
        query = query.filter(func.extract('year', models.Transaction.date) == year)
        
    return query.order_by(models.Transaction.date.desc()).all()

@router.get("/summary", response_model=schemas.SummaryResponse)
def get_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(
        models.Transaction.type,
        func.sum(models.Transaction.amount)
    ).filter(models.Transaction.user_id == current_user.id)
    
    if month and year:
        query = query.filter(
            func.extract('month', models.Transaction.date) == month,
            func.extract('year', models.Transaction.date) == year
        )
    elif year:
        query = query.filter(func.extract('year', models.Transaction.date) == year)
    
    results = query.group_by(models.Transaction.type).all()
    
    income = 0
    expense = 0
    for t_type, amount in results:
        if t_type == 'income':
            income = amount
        else:
            expense = amount
            
    return {
        "total_income": income,
        "total_expense": expense,
        "balance": income - expense
    }

@router.get("/daily-expenses", response_model=List[schemas.DailyExpense])
def get_daily_expenses(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    results = db.query(
        func.date(models.Transaction.date).label('day'),
        models.Transaction.type,
        func.sum(models.Transaction.amount)
    ).filter(
        models.Transaction.user_id == current_user.id,
        func.extract('month', models.Transaction.date) == month,
        func.extract('year', models.Transaction.date) == year
    ).group_by(
        func.date(models.Transaction.date),
        models.Transaction.type
    ).all()
    
    merged = {}
    for day, t_type, amount in results:
        day_str = str(day)
        if day_str not in merged:
            merged[day_str] = {"income": 0.0, "expense": 0.0}
        if t_type == 'income':
            merged[day_str]["income"] = amount
        else:
            merged[day_str]["expense"] = amount
            
    return [{"date": day, "income": data["income"], "expense": data["expense"]} for day, data in merged.items()]

@router.get("/frequent", response_model=List[schemas.FrequentCategory])
def get_frequent_categories(
    type: schemas.TransactionType,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Get top 5 most frequent categories for the given type
    frequent = db.query(
        models.Transaction.category,
        func.count(models.Transaction.id).label('count')
    ).filter(
        models.Transaction.user_id == current_user.id,
        models.Transaction.type == type.value
    ).group_by(
        models.Transaction.category
    ).order_by(
        func.count(models.Transaction.id).desc()
    ).limit(5).all()
    
    return [schemas.FrequentCategory(category=row[0], count=row[1]) for row in frequent]
