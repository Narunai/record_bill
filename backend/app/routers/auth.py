from typing import Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..core.config import get_supabase_issuer, get_supabase_jwks_url, settings
from ..database import get_db
from ..models import models
from ..schemas import schemas

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


def _get_jwks_client() -> PyJWKClient:
    jwks_url = get_supabase_jwks_url()
    if not jwks_url:
        raise RuntimeError("SUPABASE_URL or SUPABASE_JWKS_URL must be configured")
    return PyJWKClient(jwks_url)


def _decode_supabase_token(token: str) -> dict:
    issuer = get_supabase_issuer()
    if not issuer:
        raise RuntimeError("SUPABASE_URL or SUPABASE_JWT_ISSUER must be configured")

    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return pyjwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.SUPABASE_JWT_AUDIENCE,
        issuer=issuer,
    )


def _extract_full_name(payload: dict) -> Optional[str]:
    metadata = payload.get("user_metadata") or {}
    if isinstance(metadata, dict):
        return metadata.get("full_name") or metadata.get("name")
    return None


async def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = _decode_supabase_token(credentials.credentials)
    except (InvalidTokenError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        user = models.User(
            id=user_id,
            email=email,
            full_name=_extract_full_name(payload),
        )
        db.add(user)
    else:
        user.email = email
        full_name = _extract_full_name(payload)
        if full_name:
            user.full_name = full_name

    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync user profile",
        )

    db.refresh(user)
    return user


@router.get("/me", response_model=schemas.User)
def read_me(current_user: models.User = Depends(get_current_user)):
    return current_user
