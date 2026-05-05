from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPAuthorizationCredentials
from typing import List
from models.schemas import CreateVendorRequest, UpdateVendorRequest, ProfileOut
from config import get_supabase_admin
from middleware.auth import verify_token, require_owner, security

router = APIRouter(prefix="/vendors", tags=["vendors"])


async def _auth_owner(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    await verify_token(request, credentials)
    await require_owner(request)


@router.get("", response_model=List[ProfileOut])
async def list_vendors(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """List all vendors (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()
    result = admin.table("profiles").select("*").eq("role", "vendor").order("created_at", desc=True).execute()
    return result.data or []


@router.post("", response_model=ProfileOut, status_code=201)
async def create_vendor(
    body: CreateVendorRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new vendor account (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()

    # Create Supabase Auth user
    try:
        auth_response = admin.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not create user: {str(e)}")

    user_id = auth_response.user.id

    # Insert profile
    profile_data = {
        "id": user_id,
        "role": "vendor",
        "full_name": body.full_name,
        "email": body.email,
        "phone": body.phone,
        "company_name": body.company_name,
        "is_active": True,
    }
    result = admin.table("profiles").insert(profile_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create vendor profile")
    return result.data[0]


@router.get("/{vendor_id}", response_model=ProfileOut)
async def get_vendor(
    vendor_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a specific vendor by ID (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()
    result = admin.table("profiles").select("*").eq("id", vendor_id).eq("role", "vendor").single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return result.data


@router.patch("/{vendor_id}", response_model=ProfileOut)
async def update_vendor(
    vendor_id: str,
    body: UpdateVendorRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Update vendor info or active status (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = admin.table("profiles").update(updates).eq("id", vendor_id).eq("role", "vendor").execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return result.data[0]


@router.delete("/{vendor_id}", status_code=204)
async def delete_vendor(
    vendor_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Deactivate a vendor (soft delete via is_active=false)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()
    admin.table("profiles").update({"is_active": False}).eq("id", vendor_id).execute()
    return None
