from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import get_settings

security = HTTPBearer()


async def verify_token(request: Request, credentials: HTTPAuthorizationCredentials = None):
    """
    Validates Supabase JWT and attaches user payload to request.state.
    Used as a FastAPI dependency.
    """
    from config import get_supabase_client
    token = None

    if credentials:
        token = credentials.credentials
    else:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        supabase = get_supabase_client()
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise Exception("User not found from token")
            
        request.state.user_id = user_resp.user.id
        request.state.user_payload = {"sub": user_resp.user.id}
        return {"sub": user_resp.user.id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_owner(request: Request):
    """Dependency that enforces owner role."""
    from config import get_supabase_admin
    payload = request.state.user_payload if hasattr(request.state, "user_payload") else None
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = payload.get("sub")
    admin = get_supabase_admin()
    result = admin.table("profiles").select("role").eq("id", user_id).single().execute()

    if not result.data or result.data.get("role") != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    request.state.role = "owner"
    return user_id
