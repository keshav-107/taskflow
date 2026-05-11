import uuid
import mimetypes
import io
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from typing import List
from config import get_supabase_admin
from middleware.auth import verify_token, security
from services.storage import get_storage_service

router = APIRouter(prefix="/files", tags=["files"])

BUCKET_NAME = "task-files"
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Vendor deliverables must be PDFs
VENDOR_ALLOWED_MIME = {"application/pdf"}



@router.post("/upload/{task_id}")
async def upload_files(
    task_id: str,
    request: Request,
    file_type: str = Form(...),  # "owner_attachment" | "vendor_deliverable"
    files: List[UploadFile] = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Upload files for a task.
    - Owner can upload owner_attachment (PDF/JPEG/PNG, up to 5 files)
    - Vendor can upload vendor_deliverable (PDF only, up to 2 files)
    """
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    # Validate role vs file_type
    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    if role == "vendor" and file_type != "vendor_deliverable":
        raise HTTPException(status_code=403, detail="Vendors can only upload deliverables")
    if role == "owner" and file_type != "owner_attachment":
        raise HTTPException(status_code=403, detail="Owner can only upload attachments here")

    # Validate task access
    task = admin.table("tasks").select("*").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")

    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Enforce file count limits (generous limit for owner, 2 for vendor deliverables)
    existing = admin.table("task_files").select("id").eq("task_id", task_id).eq("file_type", file_type).execute()
    existing_count = len(existing.data or [])
    max_files = 20 if file_type == "owner_attachment" else 5

    if existing_count + len(files) > max_files:
        raise HTTPException(
            status_code=400,
            detail=f"Exceeds maximum allowed files ({max_files}) for {file_type}",
        )

    allowed = ALLOWED_MIME_TYPES if file_type == "owner_attachment" else VENDOR_ALLOWED_MIME
    uploaded = []

    for f in files:
        # Validate size
        content = await f.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail=f"File {f.filename} exceeds 10MB limit")

        # Validate MIME
        mime = f.content_type or mimetypes.guess_type(f.filename)[0] or "application/octet-stream"
        if mime not in allowed:
            raise HTTPException(status_code=415, detail=f"File type {mime} not allowed")

        # Upload to configured storage backend (Google Drive or Supabase)
        svc = get_storage_service()
        storage_path, _preview_url = await svc.upload_file(
            file_bytes=content,
            original_filename=f.filename,
            mime_type=mime,
            task_id=task_id
        )

        # Insert record in task_files
        file_id = str(uuid.uuid4())
        record = {
            "id": file_id,
            "task_id": task_id,
            "uploaded_by": user_id,
            "file_type": file_type,
            "file_name": f.filename,
            "storage_path": storage_path,
            "mime_type": mime,
        }
        db_res = admin.table("task_files").insert(record).execute()
        if not db_res.data:
            raise HTTPException(status_code=500, detail="DB insert failed")

        signed_url = svc.get_file_url(storage_path)
        preview_url = svc.get_preview_url(storage_path)
        uploaded.append({"id": file_id, "file_name": f.filename, "signed_url": signed_url, "preview_url": preview_url, "mime_type": mime})

    return {"uploaded": uploaded}


@router.get("/signed-url/{file_id}")
async def get_signed_url(
    file_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get a fresh signed URL for a file."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    file_rec = admin.table("task_files").select("*").eq("id", file_id).single().execute()
    if not file_rec.data:
        raise HTTPException(status_code=404, detail="File not found")

    f = file_rec.data
    # Check task access for vendor
    if role == "vendor":
        task = admin.table("tasks").select("vendor_id").eq("id", f["task_id"]).single().execute()
        if not task.data or task.data["vendor_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    svc = get_storage_service()
    signed_url = svc.get_file_url(f["storage_path"])
    preview_url = svc.get_preview_url(f["storage_path"])
    return {"signed_url": signed_url, "preview_url": preview_url, "file_name": f["file_name"], "mime_type": f["mime_type"]}


@router.get("/proxy/{file_id}")
async def proxy_file(
    file_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Stream file bytes through the backend.
    Frontend fetches this as a blob and creates an object URL for preview,
    avoiding Google Drive iframe/authentication embedding issues.
    """
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    file_rec = admin.table("task_files").select("*").eq("id", file_id).single().execute()
    if not file_rec.data:
        raise HTTPException(status_code=404, detail="File not found")

    f = file_rec.data
    if role == "vendor":
        task = admin.table("tasks").select("vendor_id").eq("id", f["task_id"]).single().execute()
        if not task.data or task.data["vendor_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

    try:
        svc = get_storage_service()
        file_bytes = svc.download_file_bytes(f["storage_path"])
        mime = f.get("mime_type") or "application/octet-stream"
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=mime,
            headers={"Content-Disposition": f'inline; filename="{f["file_name"]}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file: {e}")


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Delete a file from storage and DB (uploader or owner only)."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    file_rec = admin.table("task_files").select("*").eq("id", file_id).single().execute()
    if not file_rec.data:
        raise HTTPException(status_code=404, detail="File not found")

    f = file_rec.data

    if role == "vendor" and f["uploaded_by"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        svc = get_storage_service()
        svc.delete_file(f["storage_path"])
    except Exception:
        pass

    admin.table("task_files").delete().eq("id", file_id).execute()
    return None
