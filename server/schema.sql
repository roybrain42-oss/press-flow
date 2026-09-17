-- PrintFlow Multi-Tenant PostgreSQL Schema & Row-Level Security (RLS)
-- Production DDL Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants (Printing Presses)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'tnt_' || uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    address TEXT,
    description TEXT,
    logo_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended')),
    plan_id VARCHAR(30) NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'basic', 'premium')),
    settings JSONB NOT NULL DEFAULT '{
        "currency": "GHS",
        "currency_symbol": "GH₵",
        "operating_hours": "Mon-Sat 8:00 AM - 7:00 PM",
        "pay_at_shop_enabled": true,
        "online_payment_enabled": true,
        "payment_provider": "paystack",
        "document_retention_days": 30,
        "max_file_size_mb": 25
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. Users & Staff
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'usr_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin', 'owner', 'staff')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. Printing Services & Pricing
CREATE TABLE IF NOT EXISTS services (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'srv_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'printing' CHECK (category IN ('printing', 'finishing', 'copying', 'other')),
    unit_type VARCHAR(50) NOT NULL DEFAULT 'per_page' CHECK (unit_type IN ('per_page', 'per_item', 'per_document', 'fixed', 'per_copy')),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);

-- 4. Print Jobs
CREATE TABLE IF NOT EXISTS print_jobs (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'job_' || uuid_generate_v4(),
    job_number VARCHAR(50) UNIQUE NOT NULL,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    tracking_token VARCHAR(100) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_size BIGINT NOT NULL,
    document_mime VARCHAR(100) NOT NULL,
    options JSONB NOT NULL,
    estimated_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'pay_at_shop')),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'shop' CHECK (payment_method IN ('shop', 'online')),
    payment_reference VARCHAR(100),
    job_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'accepted', 'processing', 'ready_for_pickup', 'completed', 'rejected', 'cancelled')),
    status_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON print_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_number ON print_jobs(job_number);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON print_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON print_jobs(created_at DESC);

-- 5. Documents
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'doc_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id VARCHAR(64) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    download_token VARCHAR(100) NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_docs_job ON documents(job_id);

-- 6. Payments
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'pay_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id VARCHAR(64) REFERENCES print_jobs(id) ON DELETE SET NULL,
    reference VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    provider VARCHAR(50) NOT NULL DEFAULT 'paystack',
    customer_email VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);

-- 7. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'sub_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL CHECK (plan_name IN ('Free', 'Basic', 'Premium')),
    monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    max_jobs_per_month INTEGER NOT NULL DEFAULT 50,
    current_month_jobs INTEGER NOT NULL DEFAULT 0,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    renews_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'log_' || uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB,
    ip VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ==========================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR DATABASE-LEVEL TENANT ISOLATION
-- ==========================================================

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin can access all rows, or users can only access their authenticated tenant's rows
-- CREATE POLICY tenant_isolation_jobs ON print_jobs
--   USING (
--     current_setting('app.current_user_role', true) = 'super_admin'
--     OR tenant_id = current_setting('app.current_tenant_id', true)
--   );
