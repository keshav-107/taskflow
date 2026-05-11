from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPAuthorizationCredentials
from models.schemas import CreateCommentRequest
from config import get_supabase_admin
from middleware.auth import verify_token, security

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/{task_id}")
async def list_comments(
    task_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """List all comments for a task."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    # Verify access
    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    task = admin.table("tasks").select("vendor_id, owner_id").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")
    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    comments = (
        admin.table("task_comments")
        .select("*")
        .eq("task_id", task_id)
        .order("created_at", desc=False)
        .execute()
    )

    result = []
    for c in (comments.data or []):
        p = admin.table("profiles").select("full_name").eq("id", c["author_id"]).single().execute()
        c["author_name"] = p.data["full_name"] if p.data else "Unknown"
        result.append(c)

    return result


@router.post("/{task_id}", status_code=201)
async def add_comment(
    task_id: str,
    body: CreateCommentRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Add a comment to a task."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role, full_name").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"
    author_name = profile.data["full_name"] if profile.data else "Unknown"

    task = admin.table("tasks").select("vendor_id, owner_id").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")
    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    record = {
        "task_id": task_id,
        "author_id": user_id,
        "message": body.message.strip(),
    }
    result = admin.table("task_comments").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save comment")

    comment = result.data[0]
    comment["author_name"] = author_name
    return comment
