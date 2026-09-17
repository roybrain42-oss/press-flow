export type TenantStatus = 'pending_approval' | 'active' | 'suspended';
export type UserRole = 'super_admin' | 'owner' | 'staff';
export type JobStatus = 'pending' | 'accepted' | 'processing' | 'ready_for_pickup' | 'completed' | 'rejected' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'pay_at_shop';
export type ServiceUnit = 'per_page' | 'per_item' | 'per_document' | 'fixed' | 'per_copy';

export interface TenantSettings {
  currency: string;
  currency_symbol: string;
  operating_hours: string;
  pay_at_shop_enabled: boolean;
  online_payment_enabled: boolean;
  payment_provider: 'paystack' | 'flutterwave';
  document_retention_days: number;
  max_file_size_mb: number;
  contact_whatsapp?: string;
  allow_notes?: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  description: string;
  logo_url: string;
  status: TenantStatus;
  plan_id: 'free' | 'basic' | 'premium';
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  tenant_id: string | null;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  category: 'printing' | 'finishing' | 'copying' | 'other';
  unit_type: ServiceUnit;
  price: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface PrintJobOption {
  copies: number;
  paper_size: 'A4' | 'A3' | 'A5' | 'Letter';
  color_mode: 'bw' | 'color' | 'mixed';
  sidedness: 'single' | 'double';
  orientation: 'portrait' | 'landscape';
  page_range?: string;
  page_count: number;
  color_pages?: number;
  bw_pages?: number;
  binding?: 'none' | 'spiral' | 'hardcover' | 'staple';
  lamination?: 'none' | 'glossy' | 'matte';
  finishing_services: string[];
  additional_instructions?: string;
  detected_pages?: number;
  detected_color_pages?: number;
  detected_bw_pages?: number;
  fulfillment_type?: 'instant_counter' | 'pickup';
  pickup_time?: string;
  is_pickup?: boolean;
}

export interface PrintJob {
  id: string;
  job_number: string;
  tenant_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  tracking_token: string;
  document_id: string;
  document_name: string;
  document_size: number;
  document_mime: string;
  options: PrintJobOption;
  estimated_total: number;
  payment_status: PaymentStatus;
  payment_method: 'shop' | 'online';
  payment_reference?: string;
  job_status: JobStatus;
  status_notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  fulfillment_type?: 'instant_counter' | 'pickup';
  pickup_time?: string;
}

export interface DocumentRecord {
  id: string;
  tenant_id: string;
  job_id: string;
  original_name: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  download_token: string;
  access_count: number;
  expires_at: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_name: 'Free' | 'Basic' | 'Premium';
  monthly_price: number;
  status: 'active' | 'past_due' | 'canceled';
  max_jobs_per_month: number;
  current_month_jobs: number;
  starts_at: string;
  renews_at: string;
  tenant_name?: string;
  tenant_slug?: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id?: string;
  user_email?: string;
  role?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip?: string;
  created_at: string;
}

export interface DashboardData {
  counts: {
    total: number;
    pending: number;
    accepted: number;
    processing: number;
    ready_for_pickup: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  revenue: {
    today: number;
    weekly: number;
    monthly: number;
    currency: string;
  };
  recentJobs: PrintJob[];
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
  };
}
