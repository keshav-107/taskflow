-- =============================================================
-- Task Assignment App — Supabase SQL Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM ('owner', 'vendor');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'submitted', 'completed', 'rejected');
CREATE TYPE file_type AS ENUM ('owner_attachment', 'vendor_deliverable');
CREATE TYPE payment_status AS ENUM ('pending', 'paid');

-- =============================================================
-- PROFILES TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'vendor',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- TASKS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'pending',
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_tasks_vendor_id ON tasks(vendor_id);
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- =============================================================
-- TASK FILES TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS task_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id),
    file_type file_type NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_files_task_id ON task_files(task_id);

-- =============================================================
-- PAYMENTS TABLE (placeholder for future)
-- =============================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES profiles(id),
    amount NUMERIC(12, 2) NOT NULL,
    commission NUMERIC(12, 2),
    status payment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Helper: get role for current user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
    SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ── profiles ──────────────────────────────────────────────────
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = auth.uid());

-- Owner can read all profiles
CREATE POLICY "profiles_select_owner" ON profiles
    FOR SELECT USING (get_my_role() = 'owner');

-- Only service role can insert profiles (handled via backend admin client)
CREATE POLICY "profiles_insert_service" ON profiles
    FOR INSERT WITH CHECK (FALSE); -- backend uses service role, bypasses RLS

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Owner can update any profile
CREATE POLICY "profiles_update_owner" ON profiles
    FOR UPDATE USING (get_my_role() = 'owner');

-- ── tasks ─────────────────────────────────────────────────────
-- Owner can do everything on tasks
CREATE POLICY "tasks_owner_all" ON tasks
    FOR ALL USING (get_my_role() = 'owner');

-- Vendor can only see their assigned tasks
CREATE POLICY "tasks_vendor_select" ON tasks
    FOR SELECT USING (vendor_id = auth.uid());

-- Vendor can update status of their own tasks
CREATE POLICY "tasks_vendor_update" ON tasks
    FOR UPDATE USING (vendor_id = auth.uid());

-- ── task_files ────────────────────────────────────────────────
-- Owner can see all files
CREATE POLICY "files_owner_all" ON task_files
    FOR ALL USING (get_my_role() = 'owner');

-- Vendor can see files for their tasks
CREATE POLICY "files_vendor_select" ON task_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_files.task_id AND t.vendor_id = auth.uid()
        )
    );

-- Vendor can insert their own deliverables
CREATE POLICY "files_vendor_insert" ON task_files
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND file_type = 'vendor_deliverable'
        AND EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_files.task_id AND t.vendor_id = auth.uid()
        )
    );

-- Vendor can delete their own deliverables
CREATE POLICY "files_vendor_delete" ON task_files
    FOR DELETE USING (uploaded_by = auth.uid());

-- ── payments ──────────────────────────────────────────────────
-- Only owner can access payments
CREATE POLICY "payments_owner_all" ON payments
    FOR ALL USING (get_my_role() = 'owner');

-- Vendor can only see their own payments
CREATE POLICY "payments_vendor_select" ON payments
    FOR SELECT USING (vendor_id = auth.uid());

-- =============================================================
-- STORAGE BUCKET SETUP
-- Run these in SQL Editor or configure via Supabase Dashboard
-- =============================================================

-- Create private storage bucket for task files
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: owner can access all, vendor can access their task's files
CREATE POLICY "storage_owner_all" ON storage.objects
    FOR ALL USING (
        bucket_id = 'task-files' AND get_my_role() = 'owner'
    );

CREATE POLICY "storage_vendor_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'task-files'
        AND get_my_role() = 'vendor'
        AND (storage.foldername(name))[1] IN (
            SELECT id::TEXT FROM tasks WHERE vendor_id = auth.uid()
        )
    );

-- =============================================================
-- SEED: Create the owner account
-- Replace with your actual email + UUID after creating via Supabase Auth
-- =============================================================

-- Step 1: Go to Supabase Dashboard → Authentication → Users → Add User
-- Step 2: Copy the UUID and run:
-- INSERT INTO profiles (id, role, full_name, email)
-- VALUES ('<your-user-uuid>', 'owner', 'Your Name', 'your@email.com');
