from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone
from models.schemas import CreatePaymentRequest, AddTransactionRequest
from config import get_supabase_admin
from middleware.auth import verify_token, require_owner, security

router = APIRouter(prefix="/payments", tags=["payments"])

DIRECTION = {
    "owner_payment": "credit",        # money came in from owner
    "vendor_self_payment": "debit",   # vendor paid out of pocket (owed back by owner)
    "commission_deducted": "credit",  # commission earned, deducted from vendor dues
}


@router.get("/ledger")
async def get_ledger(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Owner-only: full ledger across all tasks."""
    await verify_token(request, credentials)
    await require_owner(request)
    admin = get_supabase_admin()

    payments = admin.table("payments").select("*, tasks(title, registration_no, vendor_id)").order("created_at", desc=True).execute()

    result = []
    for p in (payments.data or []):
        txns = admin.table("payment_transactions").select("*").eq("payment_id", p["id"]).execute()
        p["transactions"] = txns.data or []
        # Calculate net balance
        credits = sum(t["amount"] for t in p["transactions"] if t["direction"] == "credit")
        debits = sum(t["amount"] for t in p["transactions"] if t["direction"] == "debit")
        p["net_balance"] = credits - debits
        result.append(p)
    return result


@router.get("/{task_id}")
async def get_payment(
    task_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get payment record for a task."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    task = admin.table("tasks").select("vendor_id, owner_id").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")
    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = admin.table("payments").select("*").eq("task_id", task_id).execute()
    if not result.data:
        return None

    payment = result.data[0]
    txns = admin.table("payment_transactions").select("*").eq("payment_id", payment["id"]).order("created_at", desc=False).execute()
    payment["transactions"] = txns.data or []
    credits = sum(t["amount"] for t in payment["transactions"] if t["direction"] == "credit")
    debits = sum(t["amount"] for t in payment["transactions"] if t["direction"] == "debit")
    payment["net_balance"] = credits - debits
    return payment


@router.post("/{task_id}")
async def upsert_payment(
    task_id: str,
    body: CreatePaymentRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create or update a payment record for a task. Vendor or Owner."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    task = admin.table("tasks").select("vendor_id").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")
    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    existing = admin.table("payments").select("id").eq("task_id", task_id).execute()
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    if existing.data:
        payment_id = existing.data[0]["id"]
        result = admin.table("payments").update(payload).eq("id", payment_id).execute()
    else:
        payload["task_id"] = task_id
        result = admin.table("payments").insert(payload).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save payment")
    return result.data[0]


@router.post("/{task_id}/transaction")
async def add_transaction(
    task_id: str,
    body: AddTransactionRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Record a money movement transaction on a task's payment."""
    await verify_token(request, credentials)
    user_id = request.state.user_id
    admin = get_supabase_admin()

    profile = admin.table("profiles").select("role").eq("id", user_id).single().execute()
    role = profile.data["role"] if profile.data else "vendor"

    task = admin.table("tasks").select("vendor_id").eq("id", task_id).single().execute()
    if not task.data:
        raise HTTPException(status_code=404, detail="Task not found")
    if role == "vendor" and task.data["vendor_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get or create payment record
    existing = admin.table("payments").select("id").eq("task_id", task_id).execute()
    if existing.data:
        payment_id = existing.data[0]["id"]
    else:
        new_p = admin.table("payments").insert({"task_id": task_id}).execute()
        if not new_p.data:
            raise HTTPException(status_code=500, detail="Failed to create payment record")
        payment_id = new_p.data[0]["id"]

    direction = DIRECTION.get(body.transaction_type, "credit")
    record = {
        "payment_id": payment_id,
        "transaction_type": body.transaction_type,
        "amount": body.amount,
        "direction": direction,
        "description": body.description,
        "proof_file_url": body.proof_file_url,
        "created_by": user_id,
    }
    result = admin.table("payment_transactions").insert(record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to record transaction")

    # Auto-update payment status
    txn_types = [t["transaction_type"] for t in
                 (admin.table("payment_transactions").select("transaction_type").eq("payment_id", payment_id).execute().data or [])]
    if "owner_payment" in txn_types:
        admin.table("payments").update({"status": "owner_paid", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", payment_id).execute()
    elif "vendor_self_payment" in txn_types:
        admin.table("payments").update({"status": "vendor_paid", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", payment_id).execute()

    return result.data[0]
