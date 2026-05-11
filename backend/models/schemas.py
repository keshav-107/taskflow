from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    owner = "owner"
    vendor = "vendor"


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    submitted = "submitted"
    completed = "completed"
    rejected = "rejected"


class FileType(str, Enum):
    owner_attachment = "owner_attachment"
    vendor_deliverable = "vendor_deliverable"


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    full_name: str


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    company_name: Optional[str] = None


class ProfileOut(ProfileBase):
    id: str
    role: UserRole
    is_active: bool
    created_at: datetime


# ─── Vendor Management ────────────────────────────────────────────────────────

class CreateVendorRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    company_name: Optional[str] = None


class UpdateVendorRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    is_active: Optional[bool] = None


# ─── Tasks ────────────────────────────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    vendor_id: str
    due_date: Optional[date] = None
    registration_no: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    vendor_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[date] = None
    registration_no: Optional[str] = None


class TaskFileOut(BaseModel):
    id: str
    task_id: str
    uploaded_by: str
    file_type: FileType
    file_name: str
    mime_type: str
    signed_url: Optional[str] = None
    created_at: datetime


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    status: TaskStatus
    owner_id: str
    vendor_id: str
    due_date: Optional[date]
    registration_no: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    vendor: Optional[ProfileOut] = None
    files: Optional[List[TaskFileOut]] = None


# ─── File Upload ──────────────────────────────────────────────────────────────

class FileUploadResponse(BaseModel):
    id: str
    file_name: str
    signed_url: str
    mime_type: str


# ─── Comments ────────────────────────────────────────────────────────────────

class CreateCommentRequest(BaseModel):
    message: str


class CommentOut(BaseModel):
    id: str
    task_id: str
    author_id: str
    message: str
    author_name: Optional[str] = None
    created_at: datetime


# ─── Payment (Ledger) ─────────────────────────────────────────────────────────

class PaymentStatus(str, Enum):
    pending = "pending"
    owner_paid = "owner_paid"
    vendor_paid = "vendor_paid"
    settled = "settled"


class TransactionType(str, Enum):
    owner_payment = "owner_payment"
    vendor_self_payment = "vendor_self_payment"
    commission_deducted = "commission_deducted"


class CreatePaymentRequest(BaseModel):
    policy_amount: Optional[float] = None
    commission_amount: Optional[float] = None
    payment_link: Optional[str] = None
    notes: Optional[str] = None


class AddTransactionRequest(BaseModel):
    transaction_type: TransactionType
    amount: float
    description: Optional[str] = None
    proof_file_url: Optional[str] = None


class TransactionOut(BaseModel):
    id: str
    payment_id: str
    transaction_type: str
    amount: float
    direction: str
    description: Optional[str]
    proof_file_url: Optional[str]
    created_by: Optional[str]
    created_at: datetime


class PaymentOut(BaseModel):
    id: str
    task_id: str
    policy_amount: Optional[float]
    commission_amount: Optional[float]
    payment_link: Optional[str]
    status: str
    notes: Optional[str]
    transactions: Optional[list] = []
    created_at: datetime
    updated_at: datetime
