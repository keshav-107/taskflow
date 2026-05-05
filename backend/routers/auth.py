from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.schemas import LoginRequest, TokenResponse
from config import get_supabase_client, get_supabase_admin
from middleware.auth import verify_token, security

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate user with email/password via Supabase Auth."""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not response.user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = response.user.id
    admin = get_supabase_admin()
    profile = admin.table("profiles").select("*").eq("id", user_id).single().execute()

    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    p = profile.data
    return TokenResponse(
        access_token=response.session.access_token,
        role=p["role"],
        user_id=user_id,
        full_name=p["full_name"],
    )


@router.get("/me")
async def get_me(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Return current user's profile."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()
    result = admin.table("profiles").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data
