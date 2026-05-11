from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone
from models.schemas import CreateTaskRequest, UpdateTaskRequest, TaskOut
from config import get_supabase_admin
from middleware.auth import verify_token, require_owner, security

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _attach_vendor(task: dict, admin) -> dict:
    """Attach vendor profile to task dict."""
    vendor_id = task.get("vendor_id")
    if vendor_id:
        v = admin.table("profiles").select("*").eq("id", vendor_id).single().execute()
        task["vendor"] = v.data if v.data else None
    return task


def _attach_files(task: dict, admin) -> dict:
    """Attach file metadata (without signed URLs — use /files endpoint for those)."""
    task_id = task["id"]
    files = admin.table("task_files").select("*").eq("task_id", task_id).execute()
    task["files"] = files.data or []
    return task


# ─── Owner Routes ─────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_task(
    body: CreateTaskRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create a new task and assign to a vendor (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    owner_id = request.state.user_id
    admin = get_supabase_admin()

    task_data = {
        "title": body.title,
        "description": body.description,
        "vendor_id": body.vendor_id,
        "owner_id": owner_id,
        "status": "pending",
        "due_date": body.due_date.isoformat() if body.due_date else None,
        "registration_no": body.registration_no,
    }
    result = admin.table("tasks").insert(task_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create task")

    task = result.data[0]
    task = _attach_vendor(task, admin)
    return task


@router.get("")
async def list_tasks(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
):
    """
    List tasks. Owner sees all tasks; vendors see only their assigned tasks.
    Supports optional ?status= and ?vendor_id= filters.
    """
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    role = profile.data["role"]
    query = admin.table("tasks").select("*").order("created_at", desc=True)

    if role == "vendor":
        query = query.eq("vendor_id", user_id)
    else:
        # Owner can filter by vendor
        if vendor_id:
            query = query.eq("vendor_id", vendor_id)

    if status:
        query = query.eq("status", status)

    result = query.execute()
    tasks = result.data or []

    # Attach vendor info for owner
    if role == "owner":
        tasks = [_attach_vendor(t, admin) for t in tasks]

    return tasks


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get task detail with vendor info and files."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    result = admin.table("tasks").select("*").eq("id", task_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = result.data

    # Vendors can only see their own tasks
    if role == "vendor" and task["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    task = _attach_vendor(task, admin)
    task = _attach_files(task, admin)
    return task


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: UpdateTaskRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Update task. Owner can update any field.
    Vendor can only update status (e.g., in_progress → submitted).
    """
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    existing = admin.table("tasks").select("*").eq("id", task_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = existing.data

    if role == "vendor":
        if task["vendor_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Vendors can only update status
        updates = {}
        if body.status:
            updates["status"] = body.status
    else:
        updates = body.model_dump(exclude_none=True)
        if "due_date" in updates and updates["due_date"]:
            updates["due_date"] = updates["due_date"].isoformat()

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = admin.table("tasks").update(updates).eq("id", task_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Update failed")

    task = result.data[0]
    task = _attach_vendor(task, admin)
    return task


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Delete a task and its associated files (owner only)."""
    await verify_token(request, credentials)
    await require_owner(request)

    admin = get_supabase_admin()

    # Remove file records
    admin.table("task_files").delete().eq("task_id", task_id).execute()
    # Remove task
    admin.table("tasks").delete().eq("id", task_id).execute()
    return None
