from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .core.config import get_cors_origins
from .routers import auth, transactions
from .models import models

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Income/Expense Tracker API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Income/Expense Tracker API"}
