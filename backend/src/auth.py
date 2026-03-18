"""Cognito JWT validation and user auth dependency"""
import logging
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class CognitoUser(BaseModel):
    sub: str
    email: Optional[str] = None
    name: Optional[str] = None


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetch and cache Cognito JWKS. Cache is cleared on app restart."""
    if not settings.cognito_user_pool_id:
        raise RuntimeError("COGNITO_USER_POOL_ID is not configured")
    url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com"
        f"/{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _validate_token(token: str) -> dict:
    if not settings.cognito_user_pool_id or not settings.cognito_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Auth not configured",
        )
    try:
        jwks = _get_jwks()
        unverified = jwt.get_unverified_claims(token)
        token_use = unverified.get("token_use", "")

        if token_use == "access":
            # Access tokens don't carry aud; validate client_id claim instead
            claims = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                options={"verify_aud": False, "verify_at_hash": False},
            )
            if claims.get("client_id") != settings.cognito_client_id:
                raise JWTError("client_id mismatch")
        else:
            # id_token has aud == client_id
            claims = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                audience=settings.cognito_client_id,
                options={"verify_at_hash": False},
            )
    except JWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return claims


def _build_cognito_user(claims: dict) -> CognitoUser:
    """Construct a CognitoUser from validated JWT claims. Single source of truth for name resolution."""
    name = (
        f"{claims.get('given_name')} {claims.get('family_name')}".strip()
        or claims.get("name")
        or claims.get("cognito:username")
        or claims.get("username")
    )
    return CognitoUser(sub=claims["sub"], email=claims.get("email"), name=name)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CognitoUser:
    """FastAPI dependency — validates Bearer token, returns the Cognito user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = _validate_token(credentials.credentials)
    return _build_cognito_user(claims)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[CognitoUser]:
    """Like get_current_user but returns None instead of 401 when no token is present."""
    if not credentials:
        return None
    claims = _validate_token(credentials.credentials)
    return _build_cognito_user(claims)
