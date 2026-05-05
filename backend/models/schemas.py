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


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    vendor_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[date] = None


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


# ─── Payment (placeholder for future) ────────────────────────────────────────

class PaymentStatus(str, Enum):
    pending = "pending"
    paid = "paid"


class CreatePaymentRequest(BaseModel):
    task_id: str
    vendor_id: str
    amount: float
    commission: Optional[float] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    task_id: str
    vendor_id: str
    amount: float
    commission: Optional[float]
    status: PaymentStatus
    notes: Optional[str]
    created_at: datetime
