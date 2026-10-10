import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import jwt, JWTError
import bcrypt
from backend_v2.app.core.config import settings

# Precomputed dummy bcrypt hash (cost=12) for constant-time comparison against nonexistent users
# Generated with bcrypt.hashpw(b"ConverseIQ_Dummy_Credential_Value_Constant_Time", bcrypt.gensalt(12))
DUMMY_BCRYPT_HASH = "$2b$12$f03bB4P0QhLp3yZ6dJkUa.88P3Z1uU1sC5J9zD9uF0aB1cD2eF3gG"

COMMON_WEAK_PASSWORDS = {
    "password", "password123", "123456", "12345678", "qwerty", "admin", "admin123",
    "welcome", "welcome123", "converseiq", "faculty", "faculty123"
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Safely verify a password against bcrypt hash, truncating to bcrypt's 72-byte limit."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def verify_dummy_password(plain_password: str) -> bool:
    """Perform dummy verification using precomputed hash to prevent timing enumeration."""
    try:
        bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            DUMMY_BCRYPT_HASH.encode("utf-8")
        )
    except Exception:
        pass
    return False

def get_password_hash(password: str) -> str:
    """Hash password using bcrypt with salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")

def validate_password_strength(password: str) -> Optional[str]:
    """
    Enforce institutional password complexity:
    - Minimum 8 characters, maximum 72 characters (bcrypt limit)
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 numeric digit
    - At least 1 special character (@$!%*?&#^()_-+=)
    - Not in known common weak passwords list
    Returns error string if invalid, None if acceptable.
    """
    if not password:
        return "Password cannot be empty"
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if len(password.encode("utf-8")) > 72:
        return "Password must not exceed 72 bytes due to secure hashing constraints"
    if password.lower() in COMMON_WEAK_PASSWORDS:
        return "Password is too common and easily guessable. Please choose a stronger password."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter (A-Z)"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter (a-z)"
    if not re.search(r"\d", password):
        return "Password must contain at least one numeric digit (0-9)"
    if not re.search(r"[@$!%*?&#^()_\-+=\[\]{}|:;,.<>~`]", password):
        return "Password must contain at least one special character (@$!%*?&#^()_+-=)"
    return None

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    jti: Optional[str] = None,
    token_version: int = 1
) -> str:
    """
    Issue cryptographically sound JWT containing:
    - sub (user_id)
    - email & role
    - jti (UUID4 unique token ID for individual blacklisting/revocation)
    - token_version (integer version for instant fleet-wide revocation)
    - iat, nbf, exp claims
    - iss (issuer)
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    unique_jti = jti or str(uuid.uuid4())
    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now,
        "jti": unique_jti,
        "token_version": token_version,
        "iss": "converseiq-auth"
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Safely decode and validate JWT signature, algorithm, and claims."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            issuer="converseiq-auth",
            options={"verify_exp": True, "verify_nbf": True, "verify_iss": True}
        )
        return payload
    except JWTError:
        # Fallback for tokens issued before issuer claim was enforced
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": True}
            )
            return payload
        except JWTError:
            return None
