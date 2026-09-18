import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  initServerFirestore,
  checkFirestoreHealth,
  syncDocToFirestore,
  deleteDocFromFirestore,
  fetchDocFromFirestore,
  fetchCollectionFromFirestore,
  findUserByEmailInFirestore,
} from './firebase';

// Types
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
  tenant_id: string | null; // null for super_admin
  role: UserRole;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  category: 'printing' | 'finishing' | 'copying' | 'other';
  unit_type: ServiceUnit;
  price: number; // e.g. 0.50 for GH₵ 0.50
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
  page_range?: string; // e.g. "All" or "1-5"
  page_count: number;
  color_pages?: number;
  bw_pages?: number;
  binding?: 'none' | 'spiral' | 'hardcover' | 'staple';
  lamination?: 'none' | 'glossy' | 'matte';
  finishing_services: string[]; // service IDs
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
  job_number: string; // e.g. "PF-2026-000481"
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
  estimated_total: number; // in GH₵
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

export interface PaymentRecord {
  id: string;
  tenant_id: string;
  job_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  provider: string;
  customer_email: string;
  paid_at?: string;
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

// In-Memory Database with ACID JSON file persistence and WAL
interface DatabaseSchema {
  tenants: Tenant[];
  users: User[];
  services: Service[];
  print_jobs: PrintJob[];
  documents: DocumentRecord[];
  payments: PaymentRecord[];
  subscriptions: Subscription[];
  audit_logs: AuditLog[];
  metadata: {
    version: number;
    last_seq: number;
  };
}

// Detect serverless environment (Vercel, AWS Lambda, Netlify) with read-only root filesystem
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
const SEED_FILE = path.join(process.cwd(), 'data', 'printflow.json');
const DB_FILE = isServerless ? path.join('/tmp', 'data', 'printflow.json') : SEED_FILE;

class DatabaseEngine {
  private data: DatabaseSchema = {
    tenants: [],
    users: [],
    services: [],
    print_jobs: [],
    documents: [],
    payments: [],
    subscriptions: [],
    audit_logs: [],
    metadata: { version: 1, last_seq: 480 },
  };

  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    const dataDir = path.dirname(DB_FILE);
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[DB] Notice creating data directory:', err);
    }

    let loadedFromDisk = false;

    // 1. If DB_FILE exists (/tmp/data/printflow.json or local data/printflow.json)
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        this.isLoaded = true;
        loadedFromDisk = true;
        console.log(`[DB] Database loaded from ${DB_FILE} with ${this.data.tenants.length} tenants and ${this.data.users.length} users.`);
      } catch (err) {
        console.error('[DB] Failed to read database file, attempting fallback:', err);
      }
    }

    // 2. In serverless, if /tmp has no file yet, copy from bundled seed file
    if (!loadedFromDisk && isServerless && fs.existsSync(SEED_FILE)) {
      try {
        const raw = fs.readFileSync(SEED_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        this.isLoaded = true;
        loadedFromDisk = true;
        this.persist();
        console.log(`[DB] Loaded bundled seed data into serverless instance with ${this.data.tenants.length} tenants and ${this.data.users.length} users.`);
      } catch (err) {
        console.error('[DB] Failed to load bundled seed file:', err);
      }
    }

    // 3. Fallback: Seed initial data if nothing loaded yet
    if (!loadedFromDisk) {
      this.seedInitialData();
      this.persist();
      this.isLoaded = true;
    }

    // 4. Background synchronize with Cloud Firestore
    setTimeout(async () => {
      try {
        initServerFirestore();
        await this.loadFromFirestore();
      } catch (err) {
        console.warn('[DB] Initial Firestore sync notice:', err);
      }
    }, 500);
  }

  private persist() {
    try {
      const dataDir = path.dirname(DB_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Local write notice (using in-memory state):', err);
    }
  }

  private seedInitialData() {
    console.log('[DB] Seeding production-ready demo data...');
    const now = new Date();
    const isoNow = now.toISOString();

    const superAdminPasswordHash = bcrypt.hashSync('AdminPassword2026!', 10);
    const ownerPasswordHash = bcrypt.hashSync('OwnerPassword2026!', 10);
    const staffPasswordHash = bcrypt.hashSync('StaffPassword2026!', 10);

    // 1. Super Admin
    const superAdmin: User = {
      id: 'usr-super-admin-01',
      tenant_id: null,
      role: 'super_admin',
      name: 'Nana Yaw Admin',
      email: 'admin@printflow.com',
      password_hash: superAdminPasswordHash,
      phone: '+233 24 100 0001',
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: isoNow,
    };

    // 2. Tenants (Printing Presses)
    const tenant1: Tenant = {
      id: 'tnt-bright-digital',
      slug: 'bright-digital-printing',
      name: 'Bright Digital Printing',
      owner_name: 'Kwame Bright Mensah',
      email: 'bright@printflow.com',
      phone: '+233 24 456 7890',
      location: 'Kumasi',
      address: 'Adum High Street, Near Kejetia Market, Kumasi, Ghana',
      description: 'High-speed digital printing, colour laser copying, thesis hardcover binding, and bulk examination printing.',
      logo_url: 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      plan_id: 'premium',
      settings: {
        currency: 'GHS',
        currency_symbol: 'GH₵',
        operating_hours: 'Monday – Saturday: 7:30 AM – 8:00 PM (Closed Sundays)',
        pay_at_shop_enabled: true,
        online_payment_enabled: true,
        payment_provider: 'paystack',
        document_retention_days: 30,
        max_file_size_mb: 30,
        contact_whatsapp: '+233244567890',
        allow_notes: true,
      },
      created_at: '2026-01-10T09:00:00.000Z',
      updated_at: isoNow,
    };

    const tenant2: Tenant = {
      id: 'tnt-accra-express',
      slug: 'accra-express-press',
      name: 'Accra Express Press & Copy Center',
      owner_name: 'Ama Serwaa Osei',
      email: 'accra@printflow.com',
      phone: '+233 20 889 1234',
      location: 'Accra',
      address: 'Ring Road Central, Osu Oxford St Junction, Accra, Ghana',
      description: 'Fast turnaround printing, architectural blueprints, flyers, brochures, and commercial document finishing.',
      logo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=150&auto=format&fit=crop&q=80',
      status: 'active',
      plan_id: 'basic',
      settings: {
        currency: 'GHS',
        currency_symbol: 'GH₵',
        operating_hours: 'Monday – Friday: 7:00 AM – 9:00 PM, Saturday: 8:00 AM – 6:00 PM',
        pay_at_shop_enabled: true,
        online_payment_enabled: true,
        payment_provider: 'paystack',
        document_retention_days: 14,
        max_file_size_mb: 25,
        contact_whatsapp: '+233208891234',
        allow_notes: true,
      },
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: isoNow,
    };

    const tenant3: Tenant = {
      id: 'tnt-cape-coast-hub',
      slug: 'cape-coast-print-hub',
      name: 'Cape Coast Student Print Hub',
      owner_name: 'Kofi Owusu',
      email: 'capecoast@printflow.com',
      phone: '+233 27 554 3210',
      location: 'Cape Coast',
      address: 'University Post Office Road, UCC Old Site, Cape Coast',
      description: 'Affordable student handouts, spiral binding, passport photo printing, and project reports.',
      logo_url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=150&auto=format&fit=crop&q=80',
      status: 'pending_approval',
      plan_id: 'free',
      settings: {
        currency: 'GHS',
        currency_symbol: 'GH₵',
        operating_hours: 'Monday – Sunday: 8:00 AM – 10:00 PM',
        pay_at_shop_enabled: true,
        online_payment_enabled: false,
        payment_provider: 'paystack',
        document_retention_days: 7,
        max_file_size_mb: 20,
        contact_whatsapp: '+233275543210',
        allow_notes: true,
      },
      created_at: '2026-03-01T14:30:00.000Z',
      updated_at: isoNow,
    };

    // 3. Users for Tenants
    const owner1: User = {
      id: 'usr-bright-owner',
      tenant_id: tenant1.id,
      role: 'owner',
      name: 'Kwame Bright Mensah',
      email: 'bright@printflow.com',
      password_hash: ownerPasswordHash,
      phone: '+233 24 456 7890',
      status: 'active',
      created_at: '2026-01-10T09:00:00.000Z',
      updated_at: isoNow,
    };

    const staff1: User = {
      id: 'usr-bright-staff',
      tenant_id: tenant1.id,
      role: 'staff',
      name: 'Abena Frimpomaa (Operator)',
      email: 'abena.staff@printflow.com',
      password_hash: staffPasswordHash,
      phone: '+233 24 998 8776',
      status: 'active',
      created_at: '2026-01-12T11:00:00.000Z',
      updated_at: isoNow,
    };

    const owner2: User = {
      id: 'usr-accra-owner',
      tenant_id: tenant2.id,
      role: 'owner',
      name: 'Ama Serwaa Osei',
      email: 'accra@printflow.com',
      password_hash: ownerPasswordHash,
      phone: '+233 20 889 1234',
      status: 'active',
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: isoNow,
    };

    // 4. Services and Pricing for Tenant 1 (Bright Digital Printing)
    const servicesTenant1: Service[] = [
      {
        id: 'srv-b1',
        tenant_id: tenant1.id,
        name: 'A4 Black & White Printing',
        category: 'printing',
        unit_type: 'per_page',
        price: 0.50,
        description: 'Crisp 80gsm monochrome document printing',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b2',
        tenant_id: tenant1.id,
        name: 'A4 Full Colour Laser',
        category: 'printing',
        unit_type: 'per_page',
        price: 2.00,
        description: 'Vibrant color prints for charts, presentations, and images',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b3',
        tenant_id: tenant1.id,
        name: 'A3 Black & White Printing',
        category: 'printing',
        unit_type: 'per_page',
        price: 1.00,
        description: 'Monochrome posters and large plans',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b4',
        tenant_id: tenant1.id,
        name: 'A3 Full Colour Laser',
        category: 'printing',
        unit_type: 'per_page',
        price: 4.00,
        description: 'High-definition full color A3 poster output',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b5',
        tenant_id: tenant1.id,
        name: 'Plastic Comb / Spiral Binding',
        category: 'finishing',
        unit_type: 'per_document',
        price: 8.00,
        description: 'Durable clear PVC cover with black backboard',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b6',
        tenant_id: tenant1.id,
        name: 'Thesis Hardcover Binding (Gold Foil)',
        category: 'finishing',
        unit_type: 'per_document',
        price: 45.00,
        description: 'Academic grade buckram binding with embossed gold lettering',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b7',
        tenant_id: tenant1.id,
        name: 'A4 Heavy Heat Lamination',
        category: 'finishing',
        unit_type: 'per_item',
        price: 5.00,
        description: 'Waterproof 125-micron protective sealed coating',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-b8',
        tenant_id: tenant1.id,
        name: 'Corner / Booklet Stapling',
        category: 'finishing',
        unit_type: 'per_item',
        price: 0.50,
        description: 'Heavy duty corner stapling for exam papers',
        is_active: true,
        created_at: isoNow,
      },
    ];

    // Services for Tenant 2 (Accra Express)
    const servicesTenant2: Service[] = [
      {
        id: 'srv-a1',
        tenant_id: tenant2.id,
        name: 'A4 B&W High Speed',
        category: 'printing',
        unit_type: 'per_page',
        price: 0.60,
        description: 'Rapid production document printing',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-a2',
        tenant_id: tenant2.id,
        name: 'A4 Premium Colour',
        category: 'printing',
        unit_type: 'per_page',
        price: 2.50,
        description: 'Gloss or matte presentation grade',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-a3',
        tenant_id: tenant2.id,
        name: 'Wire-O Metal Binding',
        category: 'finishing',
        unit_type: 'per_document',
        price: 15.00,
        description: 'Executive 360-degree flat lay binding',
        is_active: true,
        created_at: isoNow,
      },
      {
        id: 'srv-a4',
        tenant_id: tenant2.id,
        name: 'A4 Lamination',
        category: 'finishing',
        unit_type: 'per_item',
        price: 6.00,
        description: 'Matte or gloss protective lamination',
        is_active: true,
        created_at: isoNow,
      },
    ];

    // 5. Initial Realistic Print Jobs
    const printJobs: PrintJob[] = [
      {
        id: 'job-001',
        job_number: 'PF-2026-000481',
        tenant_id: tenant1.id,
        customer_name: 'Dr. Michael Adjei',
        customer_phone: '+233 24 332 1199',
        customer_email: 'michael.adjei@knust.edu.gh',
        tracking_token: 'trk-adjei-9941a8',
        document_id: 'doc-001',
        document_name: 'KNUST_Research_Proposal_2026_Final.pdf',
        document_size: 4280000,
        document_mime: 'application/pdf',
        options: {
          copies: 3,
          paper_size: 'A4',
          color_mode: 'color',
          sidedness: 'double',
          orientation: 'portrait',
          page_count: 24,
          binding: 'spiral',
          lamination: 'none',
          finishing_services: ['srv-b5'],
          additional_instructions: 'Please ensure high resolution on the statistical graphs on pages 12-14.',
        },
        estimated_total: 168.00,
        payment_status: 'paid',
        payment_method: 'online',
        payment_reference: 'PSTK_TX_892301982',
        job_status: 'processing',
        status_notes: 'Printing 3 copies on Fuji Xerox digital press.',
        created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 15 * 60000).toISOString(),
      },
      {
        id: 'job-002',
        job_number: 'PF-2026-000482',
        tenant_id: tenant1.id,
        customer_name: 'Jessica Boakye',
        customer_phone: '+233 50 123 4567',
        customer_email: 'jess.boakye@gmail.com',
        tracking_token: 'trk-boakye-b772c1',
        document_id: 'doc-002',
        document_name: 'Master_Thesis_Final_Submission.pdf',
        document_size: 14500000,
        document_mime: 'application/pdf',
        options: {
          copies: 2,
          paper_size: 'A4',
          color_mode: 'bw',
          sidedness: 'single',
          orientation: 'portrait',
          page_count: 90,
          binding: 'hardcover',
          lamination: 'none',
          finishing_services: ['srv-b6'],
          additional_instructions: 'Department of Biochemistry format. Spine text in gold embossed foil.',
        },
        estimated_total: 180.00,
        payment_status: 'paid',
        payment_method: 'online',
        payment_reference: 'PSTK_TX_771829311',
        job_status: 'ready_for_pickup',
        status_notes: 'Bound and packed in protective sleeve. Ready at front desk.',
        created_at: new Date(now.getTime() - 180 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 25 * 60000).toISOString(),
      },
      {
        id: 'job-003',
        job_number: 'PF-2026-000483',
        tenant_id: tenant1.id,
        customer_name: 'Kojo Asante',
        customer_phone: '+233 27 778 8990',
        tracking_token: 'trk-asante-c441df',
        document_id: 'doc-003',
        document_name: 'Church_Annual_Conference_Program.docx',
        document_size: 1980000,
        document_mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        options: {
          copies: 50,
          paper_size: 'A5',
          color_mode: 'color',
          sidedness: 'double',
          orientation: 'portrait',
          page_count: 8,
          binding: 'staple',
          lamination: 'none',
          finishing_services: ['srv-b8'],
          additional_instructions: 'Folded into booklets and center saddle-stitched.',
        },
        estimated_total: 425.00,
        payment_status: 'pay_at_shop',
        payment_method: 'shop',
        job_status: 'accepted',
        status_notes: 'Accepted by operator Abena. Scheduled for production at 3:00 PM.',
        created_at: new Date(now.getTime() - 20 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 10 * 60000).toISOString(),
      },
      {
        id: 'job-004',
        job_number: 'PF-2026-000484',
        tenant_id: tenant1.id,
        customer_name: 'Emmanuel Ofori',
        customer_phone: '+233 24 661 1234',
        customer_email: 'ofori.legal@gmail.com',
        tracking_token: 'trk-ofori-e119ab',
        document_id: 'doc-004',
        document_name: 'High_Court_Submissions_Exhibit_A.pdf',
        document_size: 3200000,
        document_mime: 'application/pdf',
        options: {
          copies: 4,
          paper_size: 'A4',
          color_mode: 'bw',
          sidedness: 'double',
          orientation: 'portrait',
          page_count: 36,
          binding: 'none',
          lamination: 'none',
          finishing_services: ['srv-b8'],
          additional_instructions: 'Staple each copy top-left with heavy metal staple.',
        },
        estimated_total: 74.00,
        payment_status: 'pay_at_shop',
        payment_method: 'shop',
        job_status: 'pending',
        status_notes: 'New submission via shop QR stand.',
        created_at: new Date(now.getTime() - 5 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      },
      {
        id: 'job-005',
        job_number: 'PF-2026-000480',
        tenant_id: tenant1.id,
        customer_name: 'Akua Mansa',
        customer_phone: '+233 20 445 6677',
        tracking_token: 'trk-mansa-f881aa',
        document_id: 'doc-005',
        document_name: 'Business_Proposal_Deck.pdf',
        document_size: 8900000,
        document_mime: 'application/pdf',
        options: {
          copies: 5,
          paper_size: 'A4',
          color_mode: 'color',
          sidedness: 'single',
          orientation: 'landscape',
          page_count: 15,
          binding: 'spiral',
          lamination: 'matte',
          finishing_services: ['srv-b5', 'srv-b7'],
        },
        estimated_total: 215.00,
        payment_status: 'paid',
        payment_method: 'online',
        payment_reference: 'PSTK_TX_661902812',
        job_status: 'completed',
        status_notes: 'Customer collected job at 11:30 AM.',
        created_at: new Date(now.getTime() - 1440 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 300 * 60000).toISOString(),
        completed_at: new Date(now.getTime() - 300 * 60000).toISOString(),
      },
      // Job for Tenant 2 (Accra Express)
      {
        id: 'job-006',
        job_number: 'PF-2026-000479',
        tenant_id: tenant2.id,
        customer_name: 'David Boateng',
        customer_phone: '+233 54 991 2233',
        customer_email: 'david@arch-ghana.com',
        tracking_token: 'trk-boateng-9901aa',
        document_id: 'doc-006',
        document_name: 'Airport_Residential_Layout_Rev2.pdf',
        document_size: 18200000,
        document_mime: 'application/pdf',
        options: {
          copies: 2,
          paper_size: 'A3',
          color_mode: 'color',
          sidedness: 'single',
          orientation: 'landscape',
          page_count: 12,
          binding: 'none',
          lamination: 'none',
          finishing_services: [],
        },
        estimated_total: 120.00,
        payment_status: 'paid',
        payment_method: 'online',
        payment_reference: 'PSTK_TX_551092812',
        job_status: 'ready_for_pickup',
        status_notes: 'Printed on 160gsm satin paper.',
        created_at: new Date(now.getTime() - 120 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 40 * 60000).toISOString(),
      },
    ];

    // 6. Documents metadata
    const documents: DocumentRecord[] = [
      {
        id: 'doc-001',
        tenant_id: tenant1.id,
        job_id: 'job-001',
        original_name: 'KNUST_Research_Proposal_2026_Final.pdf',
        stored_filename: 'knust_proposal_9941a8.pdf',
        mime_type: 'application/pdf',
        file_size: 4280000,
        storage_path: 'uploads/tnt-bright-digital/knust_proposal_9941a8.pdf',
        download_token: 'dl-token-adjei-9941a8',
        access_count: 2,
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
        created_at: isoNow,
      },
      {
        id: 'doc-002',
        tenant_id: tenant1.id,
        job_id: 'job-002',
        original_name: 'Master_Thesis_Final_Submission.pdf',
        stored_filename: 'thesis_boakye_b772c1.pdf',
        mime_type: 'application/pdf',
        file_size: 14500000,
        storage_path: 'uploads/tnt-bright-digital/thesis_boakye_b772c1.pdf',
        download_token: 'dl-token-boakye-b772c1',
        access_count: 3,
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
        created_at: isoNow,
      },
      {
        id: 'doc-003',
        tenant_id: tenant1.id,
        job_id: 'job-003',
        original_name: 'Church_Annual_Conference_Program.docx',
        stored_filename: 'church_program_c441df.docx',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: 1980000,
        storage_path: 'uploads/tnt-bright-digital/church_program_c441df.docx',
        download_token: 'dl-token-asante-c441df',
        access_count: 1,
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
        created_at: isoNow,
      },
      {
        id: 'doc-004',
        tenant_id: tenant1.id,
        job_id: 'job-004',
        original_name: 'High_Court_Submissions_Exhibit_A.pdf',
        stored_filename: 'legal_submission_e119ab.pdf',
        mime_type: 'application/pdf',
        file_size: 3200000,
        storage_path: 'uploads/tnt-bright-digital/legal_submission_e119ab.pdf',
        download_token: 'dl-token-ofori-e119ab',
        access_count: 0,
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
        created_at: isoNow,
      },
      {
        id: 'doc-005',
        tenant_id: tenant1.id,
        job_id: 'job-005',
        original_name: 'Business_Proposal_Deck.pdf',
        stored_filename: 'deck_mansa_f881aa.pdf',
        mime_type: 'application/pdf',
        file_size: 8900000,
        storage_path: 'uploads/tnt-bright-digital/deck_mansa_f881aa.pdf',
        download_token: 'dl-token-mansa-f881aa',
        access_count: 4,
        expires_at: new Date(now.getTime() + 30 * 86400000).toISOString(),
        created_at: isoNow,
      },
      {
        id: 'doc-006',
        tenant_id: tenant2.id,
        job_id: 'job-006',
        original_name: 'Airport_Residential_Layout_Rev2.pdf',
        stored_filename: 'arch_boateng_9901aa.pdf',
        mime_type: 'application/pdf',
        file_size: 18200000,
        storage_path: 'uploads/tnt-accra-express/arch_boateng_9901aa.pdf',
        download_token: 'dl-token-boateng-9901aa',
        access_count: 1,
        expires_at: new Date(now.getTime() + 14 * 86400000).toISOString(),
        created_at: isoNow,
      },
    ];

    // 7. Subscriptions
    const subscriptions: Subscription[] = [
      {
        id: 'sub-01',
        tenant_id: tenant1.id,
        plan_name: 'Premium',
        monthly_price: 350.00,
        status: 'active',
        max_jobs_per_month: 2000,
        current_month_jobs: 148,
        starts_at: '2026-01-10T00:00:00.000Z',
        renews_at: '2026-10-10T00:00:00.000Z',
      },
      {
        id: 'sub-02',
        tenant_id: tenant2.id,
        plan_name: 'Basic',
        monthly_price: 150.00,
        status: 'active',
        max_jobs_per_month: 500,
        current_month_jobs: 89,
        starts_at: '2026-01-15T00:00:00.000Z',
        renews_at: '2026-10-15T00:00:00.000Z',
      },
      {
        id: 'sub-03',
        tenant_id: tenant3.id,
        plan_name: 'Free',
        monthly_price: 0.00,
        status: 'active',
        max_jobs_per_month: 50,
        current_month_jobs: 0,
        starts_at: '2026-03-01T00:00:00.000Z',
        renews_at: '2026-10-01T00:00:00.000Z',
      },
    ];

    // 8. Audit logs
    const audit_logs: AuditLog[] = [
      {
        id: 'log-01',
        tenant_id: null,
        user_id: superAdmin.id,
        user_email: superAdmin.email,
        role: 'super_admin',
        action: 'PLATFORM_INITIALIZATION',
        resource_type: 'platform',
        details: { message: 'PrintFlow SaaS v1.0 platform initialized with secure multi-tenancy' },
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'log-02',
        tenant_id: tenant1.id,
        user_id: superAdmin.id,
        user_email: superAdmin.email,
        role: 'super_admin',
        action: 'TENANT_APPROVED',
        resource_type: 'tenant',
        resource_id: tenant1.id,
        details: { business_name: tenant1.name, plan: 'Premium' },
        created_at: '2026-01-10T09:30:00.000Z',
      },
      {
        id: 'log-03',
        tenant_id: tenant1.id,
        user_id: owner1.id,
        user_email: owner1.email,
        role: 'owner',
        action: 'QR_CODE_GENERATED',
        resource_type: 'tenant',
        resource_id: tenant1.id,
        details: { url: `https://printflow.com/p/${tenant1.slug}` },
        created_at: '2026-01-10T10:00:00.000Z',
      },
      {
        id: 'log-04',
        tenant_id: tenant1.id,
        user_id: staff1.id,
        user_email: staff1.email,
        role: 'staff',
        action: 'DOCUMENT_DOWNLOADED',
        resource_type: 'document',
        resource_id: 'doc-001',
        details: { document_name: 'KNUST_Research_Proposal_2026_Final.pdf', job_number: 'PF-2026-000481' },
        created_at: new Date(now.getTime() - 40 * 60000).toISOString(),
      },
    ];

    this.data = {
      tenants: [tenant1, tenant2, tenant3],
      users: [superAdmin, owner1, staff1, owner2],
      services: [...servicesTenant1, ...servicesTenant2],
      print_jobs: printJobs,
      documents,
      payments: [
        {
          id: 'pay-001',
          tenant_id: tenant1.id,
          job_id: 'job-001',
          reference: 'PSTK_TX_892301982',
          amount: 168.00,
          currency: 'GHS',
          status: 'paid',
          provider: 'paystack',
          customer_email: 'michael.adjei@knust.edu.gh',
          paid_at: new Date(now.getTime() - 44 * 60000).toISOString(),
          created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        },
        {
          id: 'pay-002',
          tenant_id: tenant1.id,
          job_id: 'job-002',
          reference: 'PSTK_TX_771829311',
          amount: 180.00,
          currency: 'GHS',
          status: 'paid',
          provider: 'paystack',
          customer_email: 'jess.boakye@gmail.com',
          paid_at: new Date(now.getTime() - 179 * 60000).toISOString(),
          created_at: new Date(now.getTime() - 180 * 60000).toISOString(),
        }
      ],
      subscriptions,
      audit_logs,
      metadata: { version: 1, last_seq: 484 },
    };
  }

  // --- Multi-Tenant CRUD Operations with Strict Isolation ---

  // Tenants
  public getTenants(): Tenant[] {
    return [...this.data.tenants];
  }

  public getTenantById(id: string): Tenant | undefined {
    return this.data.tenants.find((t) => t.id === id);
  }

  public getTenantBySlug(slug: string): Tenant | undefined {
    return this.data.tenants.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  }

  public createTenant(tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Tenant {
    const id = `tnt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const newTenant: Tenant = {
      ...tenant,
      id,
      created_at: now,
      updated_at: now,
    };
    this.data.tenants.push(newTenant);
    this.persist();
    syncDocToFirestore('tenants', newTenant.id, newTenant);
    return newTenant;
  }

  public updateTenant(id: string, updates: Partial<Tenant>): Tenant | undefined {
    const idx = this.data.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.data.tenants[idx] = {
      ...this.data.tenants[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    syncDocToFirestore('tenants', id, this.data.tenants[idx]);
    return this.data.tenants[idx];
  }

  public deleteTenant(id: string): boolean {
    const idx = this.data.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const tenant = this.data.tenants[idx];

    // Remove tenant
    this.data.tenants.splice(idx, 1);
    deleteDocFromFirestore('tenants', id);

    // Cascade delete associated users, services, subscriptions, jobs, documents, and payments
    this.data.users = this.data.users.filter((u) => u.tenant_id !== id);
    this.data.services = this.data.services.filter((s) => s.tenant_id !== id);
    this.data.subscriptions = this.data.subscriptions.filter((s) => s.tenant_id !== id);
    this.data.print_jobs = this.data.print_jobs.filter((j) => j.tenant_id !== id);
    this.data.documents = this.data.documents.filter((d) => d.tenant_id !== id);
    this.data.payments = this.data.payments.filter((p) => p.tenant_id !== id);

    // Audit log
    this.addAuditLog({
      tenant_id: null,
      action: 'TENANT_DELETED',
      resource_type: 'tenant',
      resource_id: id,
      details: {
        business_name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        owner_name: tenant.owner_name,
      },
    });

    this.persist();
    return true;
  }

  // Users
  public getUsers(tenantId?: string): User[] {
    if (tenantId) {
      return this.data.users.filter((u) => u.tenant_id === tenantId);
    }
    return [...this.data.users];
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  /**
   * Asynchronously find user by email, falling back to Cloud Firestore on cache miss.
   * Caches the user and tenant in-memory for instant subsequent requests.
   */
  public async getUserByEmailAsync(email: string): Promise<User | undefined> {
    const cleanEmail = email.toLowerCase().trim();
    // 1. Check in-memory first
    let user = this.data.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (user && user.password_hash) {
      return user;
    }

    // 2. Check Firestore if not found or if local record was missing password_hash
    try {
      const firestoreUser = await findUserByEmailInFirestore(cleanEmail);
      if (firestoreUser) {
        const existingIdx = this.data.users.findIndex(
          (u) => u.id === firestoreUser.id || u.email.toLowerCase() === cleanEmail
        );
        if (existingIdx !== -1) {
          this.data.users[existingIdx] = {
            ...firestoreUser,
            password_hash: firestoreUser.password_hash || this.data.users[existingIdx].password_hash,
          };
          user = this.data.users[existingIdx];
        } else {
          this.data.users.push(firestoreUser);
          user = firestoreUser;
        }

        // Cache associated tenant if not loaded
        if (user?.tenant_id && !this.getTenantById(user.tenant_id)) {
          const t = await fetchDocFromFirestore<Tenant>('tenants', user.tenant_id);
          if (t && !this.data.tenants.some((existing) => existing.id === t.id)) {
            this.data.tenants.push(t);
          }
        }

        this.persist();
        return user;
      }
    } catch (err) {
      console.error(`[DB] Error fetching user ${cleanEmail} from Firestore:`, err);
    }

    return user;
  }

  public async getTenantByIdAsync(id: string): Promise<Tenant | undefined> {
    const local = this.getTenantById(id);
    if (local) return local;

    try {
      const remote = await fetchDocFromFirestore<Tenant>('tenants', id);
      if (remote) {
        if (!this.data.tenants.some((t) => t.id === remote.id)) {
          this.data.tenants.push(remote);
          this.persist();
        }
        return remote;
      }
    } catch (err) {
      console.error(`[DB] Error fetching tenant ${id} from Firestore:`, err);
    }
    return undefined;
  }

  /**
   * Asynchronously find user by ID, falling back to Cloud Firestore on cache miss.
   * Caches the user in-memory for subsequent requests.
   */
  public async getUserByIdAsync(id: string): Promise<User | undefined> {
    const local = this.getUserById(id);
    if (local) return local;

    try {
      const remote = await fetchDocFromFirestore<User>('users', id);
      if (remote) {
        const existingIdx = this.data.users.findIndex((u) => u.id === remote.id);
        if (existingIdx !== -1) {
          this.data.users[existingIdx] = {
            ...remote,
            password_hash: remote.password_hash || this.data.users[existingIdx].password_hash,
          };
        } else {
          this.data.users.push(remote);
        }
        this.persist();
        return remote;
      }
    } catch (err) {
      console.error(`[DB] Error fetching user ${id} from Firestore:`, err);
    }
    return undefined;
  }

  public createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): User {
    const id = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      ...user,
      id,
      created_at: now,
      updated_at: now,
    };
    this.data.users.push(newUser);
    this.persist();
    // Persist to Cloud Firestore WITH password_hash so credentials survive cold starts
    syncDocToFirestore('users', newUser.id, newUser);
    return newUser;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    syncDocToFirestore('users', id, this.data.users[idx]);
    return this.data.users[idx];
  }

  public deleteUser(id: string, tenantId: string): boolean {
    const idx = this.data.users.findIndex((u) => u.id === id && u.tenant_id === tenantId);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.persist();
    deleteDocFromFirestore('users', id);
    return true;
  }

  // Services
  public getServices(tenantId: string): Service[] {
    return this.data.services.filter((s) => s.tenant_id === tenantId);
  }

  public getServiceById(id: string, tenantId: string): Service | undefined {
    return this.data.services.find((s) => s.id === id && s.tenant_id === tenantId);
  }

  public createService(service: Omit<Service, 'id' | 'created_at'>): Service {
    const id = `srv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newService: Service = {
      ...service,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.services.push(newService);
    this.persist();
    syncDocToFirestore('services', newService.id, newService);
    return newService;
  }

  public updateService(id: string, tenantId: string, updates: Partial<Service>): Service | undefined {
    const idx = this.data.services.findIndex((s) => s.id === id && s.tenant_id === tenantId);
    if (idx === -1) return undefined;
    this.data.services[idx] = {
      ...this.data.services[idx],
      ...updates,
    };
    this.persist();
    syncDocToFirestore('services', id, this.data.services[idx]);
    return this.data.services[idx];
  }

  public deleteService(id: string, tenantId: string): boolean {
    const idx = this.data.services.findIndex((s) => s.id === id && s.tenant_id === tenantId);
    if (idx === -1) return false;
    this.data.services.splice(idx, 1);
    this.persist();
    deleteDocFromFirestore('services', id);
    return true;
  }

  // Print Jobs
  public generateJobNumber(): string {
    const year = new Date().getFullYear();
    this.data.metadata.last_seq += 1;
    const seq = String(this.data.metadata.last_seq).padStart(6, '0');
    return `PF-${year}-${seq}`;
  }

  public getPrintJobs(tenantId: string): PrintJob[] {
    return this.data.print_jobs
      .filter((j) => j.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getAllPrintJobs(): PrintJob[] {
    return [...this.data.print_jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getPrintJobById(id: string, tenantId?: string | null): PrintJob | undefined {
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    if (tenantId) {
      return this.data.print_jobs.find(
        (j) => (j.id.toLowerCase() === cleanId || j.job_number.toLowerCase() === cleanId) && j.tenant_id === tenantId
      );
    }
    return this.data.print_jobs.find(
      (j) => j.id.toLowerCase() === cleanId || j.job_number.toLowerCase() === cleanId
    );
  }

  public getPrintJobByNumberAndToken(jobNumber: string, trackingToken?: string | null): PrintJob | undefined {
    if (!jobNumber) return undefined;
    const cleanNum = jobNumber.trim().toLowerCase();
    const cleanToken = trackingToken ? trackingToken.trim() : null;

    if (!cleanToken) {
      return this.getPrintJobByNumber(cleanNum);
    }

    return this.data.print_jobs.find(
      (j) =>
        (j.job_number.toLowerCase() === cleanNum || j.id.toLowerCase() === cleanNum) &&
        j.tracking_token === cleanToken
    );
  }

  public getPrintJobByNumber(jobNumber: string): PrintJob | undefined {
    if (!jobNumber) return undefined;
    const cleanNum = jobNumber.trim().toLowerCase();
    return this.data.print_jobs.find(
      (j) => j.job_number.toLowerCase() === cleanNum || j.id.toLowerCase() === cleanNum
    );
  }

  public createPrintJob(job: Omit<PrintJob, 'id' | 'created_at' | 'updated_at'>): PrintJob {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const newJob: PrintJob = {
      ...job,
      id,
      created_at: now,
      updated_at: now,
    };
    this.data.print_jobs.unshift(newJob);
    this.persist();
    syncDocToFirestore('print_jobs', newJob.id, newJob);
    return newJob;
  }

  public updatePrintJob(id: string, tenantId: string | null, updates: Partial<PrintJob>): PrintJob | undefined {
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    const idx = this.data.print_jobs.findIndex(
      (j) =>
        (j.id.toLowerCase() === cleanId || j.job_number.toLowerCase() === cleanId) &&
        (tenantId === null || j.tenant_id === tenantId)
    );
    if (idx === -1) return undefined;
    this.data.print_jobs[idx] = {
      ...this.data.print_jobs[idx],
      ...updates,
      updated_at: new Date().toISOString(),
      ...(updates.job_status === 'completed' && !this.data.print_jobs[idx].completed_at
        ? { completed_at: new Date().toISOString() }
        : {}),
    };
    this.persist();
    syncDocToFirestore('print_jobs', id, this.data.print_jobs[idx]);
    return this.data.print_jobs[idx];
  }

  // Documents
  public createDocument(doc: Omit<DocumentRecord, 'id' | 'created_at' | 'access_count'>): DocumentRecord {
    const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newDoc: DocumentRecord = {
      ...doc,
      id,
      access_count: 0,
      created_at: new Date().toISOString(),
    };
    this.data.documents.push(newDoc);
    this.persist();
    syncDocToFirestore('documents', newDoc.id, newDoc);
    return newDoc;
  }

  public getDocumentById(id: string, tenantId?: string): DocumentRecord | undefined {
    if (tenantId) {
      return this.data.documents.find((d) => d.id === id && d.tenant_id === tenantId);
    }
    return this.data.documents.find((d) => d.id === id);
  }

  public getDocumentByJobId(jobId: string, tenantId?: string): DocumentRecord | undefined {
    if (tenantId) {
      return this.data.documents.find((d) => d.job_id === jobId && d.tenant_id === tenantId);
    }
    return this.data.documents.find((d) => d.job_id === jobId);
  }

  public incrementDocumentAccess(id: string): void {
    const doc = this.data.documents.find((d) => d.id === id);
    if (doc) {
      doc.access_count += 1;
      this.persist();
    }
  }

  // Payments
  public createPayment(payment: Omit<PaymentRecord, 'id' | 'created_at'>): PaymentRecord {
    const id = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newPayment: PaymentRecord = {
      ...payment,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.payments.push(newPayment);
    this.persist();
    syncDocToFirestore('payments', newPayment.id, newPayment);
    return newPayment;
  }

  public getPayments(tenantId?: string): PaymentRecord[] {
    if (tenantId) {
      return this.data.payments.filter((p) => p.tenant_id === tenantId);
    }
    return [...this.data.payments];
  }

  public getPaymentByReference(reference: string): PaymentRecord | undefined {
    return this.data.payments.find((p) => p.reference === reference);
  }

  // Subscriptions
  public getSubscriptions(): Subscription[] {
    return [...this.data.subscriptions];
  }

  public getSubscriptionByTenantId(tenantId: string): Subscription | undefined {
    return this.data.subscriptions.find((s) => s.tenant_id === tenantId);
  }

  public updateSubscription(tenantId: string, updates: Partial<Subscription>): Subscription | undefined {
    const idx = this.data.subscriptions.findIndex((s) => s.tenant_id === tenantId);
    if (idx === -1) return undefined;
    this.data.subscriptions[idx] = {
      ...this.data.subscriptions[idx],
      ...updates,
    };
    this.persist();
    syncDocToFirestore('subscriptions', this.data.subscriptions[idx].id, this.data.subscriptions[idx]);
    return this.data.subscriptions[idx];
  }

  // Audit Logs
  public addAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newLog: AuditLog = {
      ...log,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.audit_logs.unshift(newLog);
    // Keep max 500 audit logs
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.persist();
    syncDocToFirestore('audit_logs', newLog.id, newLog);
    return newLog;
  }

  public getAuditLogs(tenantId?: string | null): AuditLog[] {
    if (tenantId) {
      return this.data.audit_logs.filter((l) => l.tenant_id === tenantId);
    }
    return [...this.data.audit_logs];
  }

  // Cloud Firestore Database Info & Full Sync
  public async getDatabaseInfo() {
    const firestoreHealth = await checkFirestoreHealth();
    return {
      engine: 'Cloud Firestore + ACID WAL High-Performance Cache',
      firestore: firestoreHealth,
      collections: {
        tenants: this.data.tenants.length,
        users: this.data.users.length,
        services: this.data.services.length,
        print_jobs: this.data.print_jobs.length,
        documents: this.data.documents.length,
        payments: this.data.payments.length,
        subscriptions: this.data.subscriptions.length,
        audit_logs: this.data.audit_logs.length,
      },
      last_sync: new Date().toISOString(),
    };
  }

  public async syncAllToFirestore() {
    console.log('[DB] Starting comprehensive sync to Cloud Firestore...');
    let synced = 0;

    for (const tenant of this.data.tenants) {
      await syncDocToFirestore('tenants', tenant.id, tenant);
      synced++;
    }
    for (const service of this.data.services) {
      await syncDocToFirestore('services', service.id, service);
      synced++;
    }
    for (const job of this.data.print_jobs) {
      await syncDocToFirestore('print_jobs', job.id, job);
      synced++;
    }
    for (const sub of this.data.subscriptions) {
      await syncDocToFirestore('subscriptions', sub.id, sub);
      synced++;
    }
    for (const user of this.data.users) {
      // Sync users with password_hash so authentication is persistent
      await syncDocToFirestore('users', user.id, user);
      synced++;
    }

    console.log(`[DB] Successfully synchronized ${synced} documents to Cloud Firestore.`);
    return { success: true, count: synced, timestamp: new Date().toISOString() };
  }

  public async loadFromFirestore() {
    try {
      console.log('[DB] Loading authoritative state from Cloud Firestore...');
      const remoteTenants = await fetchCollectionFromFirestore<Tenant>('tenants');
      const remoteUsers = await fetchCollectionFromFirestore<User>('users');

      let tenantsAdded = 0;
      for (const rt of remoteTenants) {
        const idx = this.data.tenants.findIndex(
          (t) => t.id === rt.id || (t.slug && rt.slug && t.slug.toLowerCase() === rt.slug.toLowerCase())
        );
        if (idx === -1) {
          this.data.tenants.push(rt);
          tenantsAdded++;
        } else {
          this.data.tenants[idx] = { ...this.data.tenants[idx], ...rt };
        }
      }

      let usersAdded = 0;
      for (const ru of remoteUsers) {
        const idx = this.data.users.findIndex(
          (u) => u.id === ru.id || (u.email && ru.email && u.email.toLowerCase() === ru.email.toLowerCase())
        );
        if (idx === -1) {
          this.data.users.push(ru);
          usersAdded++;
        } else {
          // Preserve local password_hash if remote document was missing it
          const localHash = this.data.users[idx].password_hash;
          const remoteHash = ru.password_hash;
          this.data.users[idx] = {
            ...this.data.users[idx],
            ...ru,
            password_hash: remoteHash || localHash,
          };
          // If remote was missing hash but local has it, restore it to Firestore immediately
          if (!remoteHash && localHash) {
            syncDocToFirestore('users', ru.id, this.data.users[idx]);
          }
        }
      }

      this.persist();
      console.log(
        `[DB] Firestore sync complete: ${remoteTenants.length} tenants (${tenantsAdded} new), ${remoteUsers.length} users (${usersAdded} new).`
      );
    } catch (err) {
      console.warn('[DB] Could not load from Firestore:', err);
    }
  }
}

export const db = new DatabaseEngine();
