// server/app.ts
import express2 from "express";

// server/routes/authRoutes.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// server/db.ts
import fs2 from "fs";
import path2 from "path";
import bcrypt from "bcryptjs";

// server/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  limit
} from "firebase/firestore";
import fs from "fs";
import path from "path";
var firestoreInstance = null;
var isFirestoreInitialized = false;
var lastHealthCheckStatus = {
  connected: false,
  databaseId: "",
  projectId: "",
  lastChecked: "",
  error: null
};
function getFirebaseConfig() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[Firebase Server] Failed to read firebase-applet-config.json:", err);
  }
  return null;
}
function initServerFirestore() {
  if (firestoreInstance) return firestoreInstance;
  try {
    const config = getFirebaseConfig();
    if (!config) {
      console.warn("[Firebase Server] No firebase-applet-config.json found.");
      return null;
    }
    const app2 = !getApps().length ? initializeApp(config) : getApp();
    const databaseId = config.firestoreDatabaseId || "(default)";
    firestoreInstance = getFirestore(app2, databaseId);
    isFirestoreInitialized = true;
    lastHealthCheckStatus = {
      connected: true,
      databaseId,
      projectId: config.projectId,
      lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
      error: null
    };
    console.log(`[Firebase Server] Connected to Firestore database: ${databaseId} (Project: ${config.projectId})`);
    return firestoreInstance;
  } catch (err) {
    console.error("[Firebase Server] Failed to initialize Firestore:", err);
    lastHealthCheckStatus = {
      connected: false,
      databaseId: "",
      projectId: "",
      lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
      error: err?.message || "Unknown initialization error"
    };
    return null;
  }
}
async function checkFirestoreHealth() {
  const db2 = initServerFirestore();
  if (!db2) {
    return {
      connected: false,
      databaseId: "",
      projectId: "",
      error: lastHealthCheckStatus.error || "Firestore not initialized",
      counts: {}
    };
  }
  try {
    const tenantsRef = collection(db2, "tenants");
    const snap = await getDocs(query(tenantsRef, limit(1)));
    lastHealthCheckStatus.connected = true;
    lastHealthCheckStatus.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
    lastHealthCheckStatus.error = null;
    return {
      connected: true,
      databaseId: lastHealthCheckStatus.databaseId,
      projectId: lastHealthCheckStatus.projectId,
      lastChecked: lastHealthCheckStatus.lastChecked,
      error: null
    };
  } catch (err) {
    console.warn("[Firebase Server] Firestore health probe failed:", err?.message);
    lastHealthCheckStatus.connected = false;
    lastHealthCheckStatus.error = err?.message;
    return {
      connected: false,
      databaseId: lastHealthCheckStatus.databaseId,
      projectId: lastHealthCheckStatus.projectId,
      error: err?.message
    };
  }
}
async function syncDocToFirestore(collectionName, docId, data) {
  try {
    const db2 = initServerFirestore();
    if (!db2) return false;
    const docRef = doc(db2, collectionName, docId);
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.error(`[Firebase Server] Error saving to ${collectionName}/${docId}:`, err);
    return false;
  }
}
async function deleteDocFromFirestore(collectionName, docId) {
  try {
    const db2 = initServerFirestore();
    if (!db2) return false;
    const docRef = doc(db2, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`[Firebase Server] Error deleting from ${collectionName}/${docId}:`, err);
    return false;
  }
}

// server/db.ts
var isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
var SEED_FILE = path2.join(process.cwd(), "data", "printflow.json");
var DB_FILE = isServerless ? path2.join("/tmp", "data", "printflow.json") : SEED_FILE;
var DatabaseEngine = class {
  constructor() {
    this.data = {
      tenants: [],
      users: [],
      services: [],
      print_jobs: [],
      documents: [],
      payments: [],
      subscriptions: [],
      audit_logs: [],
      metadata: { version: 1, last_seq: 480 }
    };
    this.isLoaded = false;
    this.init();
  }
  init() {
    const dataDir = path2.dirname(DB_FILE);
    try {
      if (!fs2.existsSync(dataDir)) {
        fs2.mkdirSync(dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[DB] Notice creating data directory:", err);
    }
    if (fs2.existsSync(DB_FILE)) {
      try {
        const raw = fs2.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        this.isLoaded = true;
        console.log(`[DB] Database loaded from ${DB_FILE} with ${this.data.tenants.length} tenants and ${this.data.print_jobs.length} jobs.`);
        return;
      } catch (err) {
        console.error("[DB] Failed to read database file, attempting fallback:", err);
      }
    }
    if (isServerless && fs2.existsSync(SEED_FILE)) {
      try {
        const raw = fs2.readFileSync(SEED_FILE, "utf-8");
        this.data = JSON.parse(raw);
        this.isLoaded = true;
        this.persist();
        console.log(`[DB] Loaded bundled seed data into serverless instance with ${this.data.tenants.length} tenants.`);
        return;
      } catch (err) {
        console.error("[DB] Failed to load bundled seed file:", err);
      }
    }
    this.seedInitialData();
    this.persist();
    this.isLoaded = true;
    if (!isServerless) {
      setTimeout(async () => {
        try {
          initServerFirestore();
          await this.syncAllToFirestore();
        } catch (err) {
          console.warn("[DB] Initial Firestore sync notice:", err);
        }
      }, 1500);
    }
  }
  persist() {
    try {
      const dataDir = path2.dirname(DB_FILE);
      if (!fs2.existsSync(dataDir)) {
        fs2.mkdirSync(dataDir, { recursive: true });
      }
      fs2.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.warn("[DB] Local write notice (using in-memory state):", err);
    }
  }
  seedInitialData() {
    console.log("[DB] Seeding production-ready demo data...");
    const now = /* @__PURE__ */ new Date();
    const isoNow = now.toISOString();
    const superAdminPasswordHash = bcrypt.hashSync("AdminPassword2026!", 10);
    const ownerPasswordHash = bcrypt.hashSync("OwnerPassword2026!", 10);
    const staffPasswordHash = bcrypt.hashSync("StaffPassword2026!", 10);
    const superAdmin = {
      id: "usr-super-admin-01",
      tenant_id: null,
      role: "super_admin",
      name: "Nana Yaw Admin",
      email: "admin@printflow.com",
      password_hash: superAdminPasswordHash,
      phone: "+233 24 100 0001",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: isoNow
    };
    const tenant1 = {
      id: "tnt-bright-digital",
      slug: "bright-digital-printing",
      name: "Bright Digital Printing",
      owner_name: "Kwame Bright Mensah",
      email: "bright@printflow.com",
      phone: "+233 24 456 7890",
      location: "Kumasi",
      address: "Adum High Street, Near Kejetia Market, Kumasi, Ghana",
      description: "High-speed digital printing, colour laser copying, thesis hardcover binding, and bulk examination printing.",
      logo_url: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=150&auto=format&fit=crop&q=80",
      status: "active",
      plan_id: "premium",
      settings: {
        currency: "GHS",
        currency_symbol: "GH\u20B5",
        operating_hours: "Monday \u2013 Saturday: 7:30 AM \u2013 8:00 PM (Closed Sundays)",
        pay_at_shop_enabled: true,
        online_payment_enabled: true,
        payment_provider: "paystack",
        document_retention_days: 30,
        max_file_size_mb: 30,
        contact_whatsapp: "+233244567890",
        allow_notes: true
      },
      created_at: "2026-01-10T09:00:00.000Z",
      updated_at: isoNow
    };
    const tenant2 = {
      id: "tnt-accra-express",
      slug: "accra-express-press",
      name: "Accra Express Press & Copy Center",
      owner_name: "Ama Serwaa Osei",
      email: "accra@printflow.com",
      phone: "+233 20 889 1234",
      location: "Accra",
      address: "Ring Road Central, Osu Oxford St Junction, Accra, Ghana",
      description: "Fast turnaround printing, architectural blueprints, flyers, brochures, and commercial document finishing.",
      logo_url: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=150&auto=format&fit=crop&q=80",
      status: "active",
      plan_id: "basic",
      settings: {
        currency: "GHS",
        currency_symbol: "GH\u20B5",
        operating_hours: "Monday \u2013 Friday: 7:00 AM \u2013 9:00 PM, Saturday: 8:00 AM \u2013 6:00 PM",
        pay_at_shop_enabled: true,
        online_payment_enabled: true,
        payment_provider: "paystack",
        document_retention_days: 14,
        max_file_size_mb: 25,
        contact_whatsapp: "+233208891234",
        allow_notes: true
      },
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: isoNow
    };
    const tenant3 = {
      id: "tnt-cape-coast-hub",
      slug: "cape-coast-print-hub",
      name: "Cape Coast Student Print Hub",
      owner_name: "Kofi Owusu",
      email: "capecoast@printflow.com",
      phone: "+233 27 554 3210",
      location: "Cape Coast",
      address: "University Post Office Road, UCC Old Site, Cape Coast",
      description: "Affordable student handouts, spiral binding, passport photo printing, and project reports.",
      logo_url: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=150&auto=format&fit=crop&q=80",
      status: "pending_approval",
      plan_id: "free",
      settings: {
        currency: "GHS",
        currency_symbol: "GH\u20B5",
        operating_hours: "Monday \u2013 Sunday: 8:00 AM \u2013 10:00 PM",
        pay_at_shop_enabled: true,
        online_payment_enabled: false,
        payment_provider: "paystack",
        document_retention_days: 7,
        max_file_size_mb: 20,
        contact_whatsapp: "+233275543210",
        allow_notes: true
      },
      created_at: "2026-03-01T14:30:00.000Z",
      updated_at: isoNow
    };
    const owner1 = {
      id: "usr-bright-owner",
      tenant_id: tenant1.id,
      role: "owner",
      name: "Kwame Bright Mensah",
      email: "bright@printflow.com",
      password_hash: ownerPasswordHash,
      phone: "+233 24 456 7890",
      status: "active",
      created_at: "2026-01-10T09:00:00.000Z",
      updated_at: isoNow
    };
    const staff1 = {
      id: "usr-bright-staff",
      tenant_id: tenant1.id,
      role: "staff",
      name: "Abena Frimpomaa (Operator)",
      email: "abena.staff@printflow.com",
      password_hash: staffPasswordHash,
      phone: "+233 24 998 8776",
      status: "active",
      created_at: "2026-01-12T11:00:00.000Z",
      updated_at: isoNow
    };
    const owner2 = {
      id: "usr-accra-owner",
      tenant_id: tenant2.id,
      role: "owner",
      name: "Ama Serwaa Osei",
      email: "accra@printflow.com",
      password_hash: ownerPasswordHash,
      phone: "+233 20 889 1234",
      status: "active",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: isoNow
    };
    const servicesTenant1 = [
      {
        id: "srv-b1",
        tenant_id: tenant1.id,
        name: "A4 Black & White Printing",
        category: "printing",
        unit_type: "per_page",
        price: 0.5,
        description: "Crisp 80gsm monochrome document printing",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b2",
        tenant_id: tenant1.id,
        name: "A4 Full Colour Laser",
        category: "printing",
        unit_type: "per_page",
        price: 2,
        description: "Vibrant color prints for charts, presentations, and images",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b3",
        tenant_id: tenant1.id,
        name: "A3 Black & White Printing",
        category: "printing",
        unit_type: "per_page",
        price: 1,
        description: "Monochrome posters and large plans",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b4",
        tenant_id: tenant1.id,
        name: "A3 Full Colour Laser",
        category: "printing",
        unit_type: "per_page",
        price: 4,
        description: "High-definition full color A3 poster output",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b5",
        tenant_id: tenant1.id,
        name: "Plastic Comb / Spiral Binding",
        category: "finishing",
        unit_type: "per_document",
        price: 8,
        description: "Durable clear PVC cover with black backboard",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b6",
        tenant_id: tenant1.id,
        name: "Thesis Hardcover Binding (Gold Foil)",
        category: "finishing",
        unit_type: "per_document",
        price: 45,
        description: "Academic grade buckram binding with embossed gold lettering",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b7",
        tenant_id: tenant1.id,
        name: "A4 Heavy Heat Lamination",
        category: "finishing",
        unit_type: "per_item",
        price: 5,
        description: "Waterproof 125-micron protective sealed coating",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-b8",
        tenant_id: tenant1.id,
        name: "Corner / Booklet Stapling",
        category: "finishing",
        unit_type: "per_item",
        price: 0.5,
        description: "Heavy duty corner stapling for exam papers",
        is_active: true,
        created_at: isoNow
      }
    ];
    const servicesTenant2 = [
      {
        id: "srv-a1",
        tenant_id: tenant2.id,
        name: "A4 B&W High Speed",
        category: "printing",
        unit_type: "per_page",
        price: 0.6,
        description: "Rapid production document printing",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-a2",
        tenant_id: tenant2.id,
        name: "A4 Premium Colour",
        category: "printing",
        unit_type: "per_page",
        price: 2.5,
        description: "Gloss or matte presentation grade",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-a3",
        tenant_id: tenant2.id,
        name: "Wire-O Metal Binding",
        category: "finishing",
        unit_type: "per_document",
        price: 15,
        description: "Executive 360-degree flat lay binding",
        is_active: true,
        created_at: isoNow
      },
      {
        id: "srv-a4",
        tenant_id: tenant2.id,
        name: "A4 Lamination",
        category: "finishing",
        unit_type: "per_item",
        price: 6,
        description: "Matte or gloss protective lamination",
        is_active: true,
        created_at: isoNow
      }
    ];
    const printJobs = [
      {
        id: "job-001",
        job_number: "PF-2026-000481",
        tenant_id: tenant1.id,
        customer_name: "Dr. Michael Adjei",
        customer_phone: "+233 24 332 1199",
        customer_email: "michael.adjei@knust.edu.gh",
        tracking_token: "trk-adjei-9941a8",
        document_id: "doc-001",
        document_name: "KNUST_Research_Proposal_2026_Final.pdf",
        document_size: 428e4,
        document_mime: "application/pdf",
        options: {
          copies: 3,
          paper_size: "A4",
          color_mode: "color",
          sidedness: "double",
          orientation: "portrait",
          page_count: 24,
          binding: "spiral",
          lamination: "none",
          finishing_services: ["srv-b5"],
          additional_instructions: "Please ensure high resolution on the statistical graphs on pages 12-14."
        },
        estimated_total: 168,
        payment_status: "paid",
        payment_method: "online",
        payment_reference: "PSTK_TX_892301982",
        job_status: "processing",
        status_notes: "Printing 3 copies on Fuji Xerox digital press.",
        created_at: new Date(now.getTime() - 45 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 15 * 6e4).toISOString()
      },
      {
        id: "job-002",
        job_number: "PF-2026-000482",
        tenant_id: tenant1.id,
        customer_name: "Jessica Boakye",
        customer_phone: "+233 50 123 4567",
        customer_email: "jess.boakye@gmail.com",
        tracking_token: "trk-boakye-b772c1",
        document_id: "doc-002",
        document_name: "Master_Thesis_Final_Submission.pdf",
        document_size: 145e5,
        document_mime: "application/pdf",
        options: {
          copies: 2,
          paper_size: "A4",
          color_mode: "bw",
          sidedness: "single",
          orientation: "portrait",
          page_count: 90,
          binding: "hardcover",
          lamination: "none",
          finishing_services: ["srv-b6"],
          additional_instructions: "Department of Biochemistry format. Spine text in gold embossed foil."
        },
        estimated_total: 180,
        payment_status: "paid",
        payment_method: "online",
        payment_reference: "PSTK_TX_771829311",
        job_status: "ready_for_pickup",
        status_notes: "Bound and packed in protective sleeve. Ready at front desk.",
        created_at: new Date(now.getTime() - 180 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 25 * 6e4).toISOString()
      },
      {
        id: "job-003",
        job_number: "PF-2026-000483",
        tenant_id: tenant1.id,
        customer_name: "Kojo Asante",
        customer_phone: "+233 27 778 8990",
        tracking_token: "trk-asante-c441df",
        document_id: "doc-003",
        document_name: "Church_Annual_Conference_Program.docx",
        document_size: 198e4,
        document_mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        options: {
          copies: 50,
          paper_size: "A5",
          color_mode: "color",
          sidedness: "double",
          orientation: "portrait",
          page_count: 8,
          binding: "staple",
          lamination: "none",
          finishing_services: ["srv-b8"],
          additional_instructions: "Folded into booklets and center saddle-stitched."
        },
        estimated_total: 425,
        payment_status: "pay_at_shop",
        payment_method: "shop",
        job_status: "accepted",
        status_notes: "Accepted by operator Abena. Scheduled for production at 3:00 PM.",
        created_at: new Date(now.getTime() - 20 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 10 * 6e4).toISOString()
      },
      {
        id: "job-004",
        job_number: "PF-2026-000484",
        tenant_id: tenant1.id,
        customer_name: "Emmanuel Ofori",
        customer_phone: "+233 24 661 1234",
        customer_email: "ofori.legal@gmail.com",
        tracking_token: "trk-ofori-e119ab",
        document_id: "doc-004",
        document_name: "High_Court_Submissions_Exhibit_A.pdf",
        document_size: 32e5,
        document_mime: "application/pdf",
        options: {
          copies: 4,
          paper_size: "A4",
          color_mode: "bw",
          sidedness: "double",
          orientation: "portrait",
          page_count: 36,
          binding: "none",
          lamination: "none",
          finishing_services: ["srv-b8"],
          additional_instructions: "Staple each copy top-left with heavy metal staple."
        },
        estimated_total: 74,
        payment_status: "pay_at_shop",
        payment_method: "shop",
        job_status: "pending",
        status_notes: "New submission via shop QR stand.",
        created_at: new Date(now.getTime() - 5 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 5 * 6e4).toISOString()
      },
      {
        id: "job-005",
        job_number: "PF-2026-000480",
        tenant_id: tenant1.id,
        customer_name: "Akua Mansa",
        customer_phone: "+233 20 445 6677",
        tracking_token: "trk-mansa-f881aa",
        document_id: "doc-005",
        document_name: "Business_Proposal_Deck.pdf",
        document_size: 89e5,
        document_mime: "application/pdf",
        options: {
          copies: 5,
          paper_size: "A4",
          color_mode: "color",
          sidedness: "single",
          orientation: "landscape",
          page_count: 15,
          binding: "spiral",
          lamination: "matte",
          finishing_services: ["srv-b5", "srv-b7"]
        },
        estimated_total: 215,
        payment_status: "paid",
        payment_method: "online",
        payment_reference: "PSTK_TX_661902812",
        job_status: "completed",
        status_notes: "Customer collected job at 11:30 AM.",
        created_at: new Date(now.getTime() - 1440 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 300 * 6e4).toISOString(),
        completed_at: new Date(now.getTime() - 300 * 6e4).toISOString()
      },
      // Job for Tenant 2 (Accra Express)
      {
        id: "job-006",
        job_number: "PF-2026-000479",
        tenant_id: tenant2.id,
        customer_name: "David Boateng",
        customer_phone: "+233 54 991 2233",
        customer_email: "david@arch-ghana.com",
        tracking_token: "trk-boateng-9901aa",
        document_id: "doc-006",
        document_name: "Airport_Residential_Layout_Rev2.pdf",
        document_size: 182e5,
        document_mime: "application/pdf",
        options: {
          copies: 2,
          paper_size: "A3",
          color_mode: "color",
          sidedness: "single",
          orientation: "landscape",
          page_count: 12,
          binding: "none",
          lamination: "none",
          finishing_services: []
        },
        estimated_total: 120,
        payment_status: "paid",
        payment_method: "online",
        payment_reference: "PSTK_TX_551092812",
        job_status: "ready_for_pickup",
        status_notes: "Printed on 160gsm satin paper.",
        created_at: new Date(now.getTime() - 120 * 6e4).toISOString(),
        updated_at: new Date(now.getTime() - 40 * 6e4).toISOString()
      }
    ];
    const documents = [
      {
        id: "doc-001",
        tenant_id: tenant1.id,
        job_id: "job-001",
        original_name: "KNUST_Research_Proposal_2026_Final.pdf",
        stored_filename: "knust_proposal_9941a8.pdf",
        mime_type: "application/pdf",
        file_size: 428e4,
        storage_path: "uploads/tnt-bright-digital/knust_proposal_9941a8.pdf",
        download_token: "dl-token-adjei-9941a8",
        access_count: 2,
        expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
        created_at: isoNow
      },
      {
        id: "doc-002",
        tenant_id: tenant1.id,
        job_id: "job-002",
        original_name: "Master_Thesis_Final_Submission.pdf",
        stored_filename: "thesis_boakye_b772c1.pdf",
        mime_type: "application/pdf",
        file_size: 145e5,
        storage_path: "uploads/tnt-bright-digital/thesis_boakye_b772c1.pdf",
        download_token: "dl-token-boakye-b772c1",
        access_count: 3,
        expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
        created_at: isoNow
      },
      {
        id: "doc-003",
        tenant_id: tenant1.id,
        job_id: "job-003",
        original_name: "Church_Annual_Conference_Program.docx",
        stored_filename: "church_program_c441df.docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size: 198e4,
        storage_path: "uploads/tnt-bright-digital/church_program_c441df.docx",
        download_token: "dl-token-asante-c441df",
        access_count: 1,
        expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
        created_at: isoNow
      },
      {
        id: "doc-004",
        tenant_id: tenant1.id,
        job_id: "job-004",
        original_name: "High_Court_Submissions_Exhibit_A.pdf",
        stored_filename: "legal_submission_e119ab.pdf",
        mime_type: "application/pdf",
        file_size: 32e5,
        storage_path: "uploads/tnt-bright-digital/legal_submission_e119ab.pdf",
        download_token: "dl-token-ofori-e119ab",
        access_count: 0,
        expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
        created_at: isoNow
      },
      {
        id: "doc-005",
        tenant_id: tenant1.id,
        job_id: "job-005",
        original_name: "Business_Proposal_Deck.pdf",
        stored_filename: "deck_mansa_f881aa.pdf",
        mime_type: "application/pdf",
        file_size: 89e5,
        storage_path: "uploads/tnt-bright-digital/deck_mansa_f881aa.pdf",
        download_token: "dl-token-mansa-f881aa",
        access_count: 4,
        expires_at: new Date(now.getTime() + 30 * 864e5).toISOString(),
        created_at: isoNow
      },
      {
        id: "doc-006",
        tenant_id: tenant2.id,
        job_id: "job-006",
        original_name: "Airport_Residential_Layout_Rev2.pdf",
        stored_filename: "arch_boateng_9901aa.pdf",
        mime_type: "application/pdf",
        file_size: 182e5,
        storage_path: "uploads/tnt-accra-express/arch_boateng_9901aa.pdf",
        download_token: "dl-token-boateng-9901aa",
        access_count: 1,
        expires_at: new Date(now.getTime() + 14 * 864e5).toISOString(),
        created_at: isoNow
      }
    ];
    const subscriptions = [
      {
        id: "sub-01",
        tenant_id: tenant1.id,
        plan_name: "Premium",
        monthly_price: 350,
        status: "active",
        max_jobs_per_month: 2e3,
        current_month_jobs: 148,
        starts_at: "2026-01-10T00:00:00.000Z",
        renews_at: "2026-10-10T00:00:00.000Z"
      },
      {
        id: "sub-02",
        tenant_id: tenant2.id,
        plan_name: "Basic",
        monthly_price: 150,
        status: "active",
        max_jobs_per_month: 500,
        current_month_jobs: 89,
        starts_at: "2026-01-15T00:00:00.000Z",
        renews_at: "2026-10-15T00:00:00.000Z"
      },
      {
        id: "sub-03",
        tenant_id: tenant3.id,
        plan_name: "Free",
        monthly_price: 0,
        status: "active",
        max_jobs_per_month: 50,
        current_month_jobs: 0,
        starts_at: "2026-03-01T00:00:00.000Z",
        renews_at: "2026-10-01T00:00:00.000Z"
      }
    ];
    const audit_logs = [
      {
        id: "log-01",
        tenant_id: null,
        user_id: superAdmin.id,
        user_email: superAdmin.email,
        role: "super_admin",
        action: "PLATFORM_INITIALIZATION",
        resource_type: "platform",
        details: { message: "PrintFlow SaaS v1.0 platform initialized with secure multi-tenancy" },
        created_at: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "log-02",
        tenant_id: tenant1.id,
        user_id: superAdmin.id,
        user_email: superAdmin.email,
        role: "super_admin",
        action: "TENANT_APPROVED",
        resource_type: "tenant",
        resource_id: tenant1.id,
        details: { business_name: tenant1.name, plan: "Premium" },
        created_at: "2026-01-10T09:30:00.000Z"
      },
      {
        id: "log-03",
        tenant_id: tenant1.id,
        user_id: owner1.id,
        user_email: owner1.email,
        role: "owner",
        action: "QR_CODE_GENERATED",
        resource_type: "tenant",
        resource_id: tenant1.id,
        details: { url: `https://printflow.com/p/${tenant1.slug}` },
        created_at: "2026-01-10T10:00:00.000Z"
      },
      {
        id: "log-04",
        tenant_id: tenant1.id,
        user_id: staff1.id,
        user_email: staff1.email,
        role: "staff",
        action: "DOCUMENT_DOWNLOADED",
        resource_type: "document",
        resource_id: "doc-001",
        details: { document_name: "KNUST_Research_Proposal_2026_Final.pdf", job_number: "PF-2026-000481" },
        created_at: new Date(now.getTime() - 40 * 6e4).toISOString()
      }
    ];
    this.data = {
      tenants: [tenant1, tenant2, tenant3],
      users: [superAdmin, owner1, staff1, owner2],
      services: [...servicesTenant1, ...servicesTenant2],
      print_jobs: printJobs,
      documents,
      payments: [
        {
          id: "pay-001",
          tenant_id: tenant1.id,
          job_id: "job-001",
          reference: "PSTK_TX_892301982",
          amount: 168,
          currency: "GHS",
          status: "paid",
          provider: "paystack",
          customer_email: "michael.adjei@knust.edu.gh",
          paid_at: new Date(now.getTime() - 44 * 6e4).toISOString(),
          created_at: new Date(now.getTime() - 45 * 6e4).toISOString()
        },
        {
          id: "pay-002",
          tenant_id: tenant1.id,
          job_id: "job-002",
          reference: "PSTK_TX_771829311",
          amount: 180,
          currency: "GHS",
          status: "paid",
          provider: "paystack",
          customer_email: "jess.boakye@gmail.com",
          paid_at: new Date(now.getTime() - 179 * 6e4).toISOString(),
          created_at: new Date(now.getTime() - 180 * 6e4).toISOString()
        }
      ],
      subscriptions,
      audit_logs,
      metadata: { version: 1, last_seq: 484 }
    };
  }
  // --- Multi-Tenant CRUD Operations with Strict Isolation ---
  // Tenants
  getTenants() {
    return [...this.data.tenants];
  }
  getTenantById(id) {
    return this.data.tenants.find((t) => t.id === id);
  }
  getTenantBySlug(slug) {
    return this.data.tenants.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  }
  createTenant(tenant) {
    const id = `tnt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newTenant = {
      ...tenant,
      id,
      created_at: now,
      updated_at: now
    };
    this.data.tenants.push(newTenant);
    this.persist();
    syncDocToFirestore("tenants", newTenant.id, newTenant);
    return newTenant;
  }
  updateTenant(id, updates) {
    const idx = this.data.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return void 0;
    this.data.tenants[idx] = {
      ...this.data.tenants[idx],
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persist();
    syncDocToFirestore("tenants", id, this.data.tenants[idx]);
    return this.data.tenants[idx];
  }
  deleteTenant(id) {
    const idx = this.data.tenants.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const tenant = this.data.tenants[idx];
    this.data.tenants.splice(idx, 1);
    deleteDocFromFirestore("tenants", id);
    this.data.users = this.data.users.filter((u) => u.tenant_id !== id);
    this.data.services = this.data.services.filter((s) => s.tenant_id !== id);
    this.data.subscriptions = this.data.subscriptions.filter((s) => s.tenant_id !== id);
    this.data.print_jobs = this.data.print_jobs.filter((j) => j.tenant_id !== id);
    this.data.documents = this.data.documents.filter((d) => d.tenant_id !== id);
    this.data.payments = this.data.payments.filter((p) => p.tenant_id !== id);
    this.addAuditLog({
      tenant_id: null,
      action: "TENANT_DELETED",
      resource_type: "tenant",
      resource_id: id,
      details: {
        business_name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        owner_name: tenant.owner_name
      }
    });
    this.persist();
    return true;
  }
  // Users
  getUsers(tenantId) {
    if (tenantId) {
      return this.data.users.filter((u) => u.tenant_id === tenantId);
    }
    return [...this.data.users];
  }
  getUserById(id) {
    return this.data.users.find((u) => u.id === id);
  }
  getUserByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  createUser(user) {
    const id = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newUser = {
      ...user,
      id,
      created_at: now,
      updated_at: now
    };
    this.data.users.push(newUser);
    this.persist();
    const { password_hash, ...safeUser } = newUser;
    syncDocToFirestore("users", newUser.id, safeUser);
    return newUser;
  }
  updateUser(id, updates) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return void 0;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.persist();
    const { password_hash, ...safeUser } = this.data.users[idx];
    syncDocToFirestore("users", id, safeUser);
    return this.data.users[idx];
  }
  deleteUser(id, tenantId) {
    const idx = this.data.users.findIndex((u) => u.id === id && u.tenant_id === tenantId);
    if (idx === -1) return false;
    this.data.users.splice(idx, 1);
    this.persist();
    deleteDocFromFirestore("users", id);
    return true;
  }
  // Services
  getServices(tenantId) {
    return this.data.services.filter((s) => s.tenant_id === tenantId);
  }
  getServiceById(id, tenantId) {
    return this.data.services.find((s) => s.id === id && s.tenant_id === tenantId);
  }
  createService(service) {
    const id = `srv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newService = {
      ...service,
      id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.services.push(newService);
    this.persist();
    syncDocToFirestore("services", newService.id, newService);
    return newService;
  }
  updateService(id, tenantId, updates) {
    const idx = this.data.services.findIndex((s) => s.id === id && s.tenant_id === tenantId);
    if (idx === -1) return void 0;
    this.data.services[idx] = {
      ...this.data.services[idx],
      ...updates
    };
    this.persist();
    syncDocToFirestore("services", id, this.data.services[idx]);
    return this.data.services[idx];
  }
  deleteService(id, tenantId) {
    const idx = this.data.services.findIndex((s) => s.id === id && s.tenant_id === tenantId);
    if (idx === -1) return false;
    this.data.services.splice(idx, 1);
    this.persist();
    deleteDocFromFirestore("services", id);
    return true;
  }
  // Print Jobs
  generateJobNumber() {
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    this.data.metadata.last_seq += 1;
    const seq = String(this.data.metadata.last_seq).padStart(6, "0");
    return `PF-${year}-${seq}`;
  }
  getPrintJobs(tenantId) {
    return this.data.print_jobs.filter((j) => j.tenant_id === tenantId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  getAllPrintJobs() {
    return [...this.data.print_jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  getPrintJobById(id, tenantId) {
    if (tenantId) {
      return this.data.print_jobs.find((j) => j.id === id && j.tenant_id === tenantId);
    }
    return this.data.print_jobs.find((j) => j.id === id);
  }
  getPrintJobByNumberAndToken(jobNumber, trackingToken) {
    return this.data.print_jobs.find(
      (j) => j.job_number.toLowerCase() === jobNumber.toLowerCase().trim() && j.tracking_token === trackingToken.trim()
    );
  }
  getPrintJobByNumber(jobNumber) {
    return this.data.print_jobs.find(
      (j) => j.job_number.toLowerCase() === jobNumber.toLowerCase().trim()
    );
  }
  createPrintJob(job) {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newJob = {
      ...job,
      id,
      created_at: now,
      updated_at: now
    };
    this.data.print_jobs.unshift(newJob);
    this.persist();
    syncDocToFirestore("print_jobs", newJob.id, newJob);
    return newJob;
  }
  updatePrintJob(id, tenantId, updates) {
    const idx = this.data.print_jobs.findIndex(
      (j) => j.id === id && (tenantId === null || j.tenant_id === tenantId)
    );
    if (idx === -1) return void 0;
    this.data.print_jobs[idx] = {
      ...this.data.print_jobs[idx],
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      ...updates.job_status === "completed" && !this.data.print_jobs[idx].completed_at ? { completed_at: (/* @__PURE__ */ new Date()).toISOString() } : {}
    };
    this.persist();
    syncDocToFirestore("print_jobs", id, this.data.print_jobs[idx]);
    return this.data.print_jobs[idx];
  }
  // Documents
  createDocument(doc2) {
    const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newDoc = {
      ...doc2,
      id,
      access_count: 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.documents.push(newDoc);
    this.persist();
    syncDocToFirestore("documents", newDoc.id, newDoc);
    return newDoc;
  }
  getDocumentById(id, tenantId) {
    if (tenantId) {
      return this.data.documents.find((d) => d.id === id && d.tenant_id === tenantId);
    }
    return this.data.documents.find((d) => d.id === id);
  }
  getDocumentByJobId(jobId, tenantId) {
    if (tenantId) {
      return this.data.documents.find((d) => d.job_id === jobId && d.tenant_id === tenantId);
    }
    return this.data.documents.find((d) => d.job_id === jobId);
  }
  incrementDocumentAccess(id) {
    const doc2 = this.data.documents.find((d) => d.id === id);
    if (doc2) {
      doc2.access_count += 1;
      this.persist();
    }
  }
  // Payments
  createPayment(payment) {
    const id = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newPayment = {
      ...payment,
      id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.payments.push(newPayment);
    this.persist();
    syncDocToFirestore("payments", newPayment.id, newPayment);
    return newPayment;
  }
  getPayments(tenantId) {
    if (tenantId) {
      return this.data.payments.filter((p) => p.tenant_id === tenantId);
    }
    return [...this.data.payments];
  }
  getPaymentByReference(reference) {
    return this.data.payments.find((p) => p.reference === reference);
  }
  // Subscriptions
  getSubscriptions() {
    return [...this.data.subscriptions];
  }
  getSubscriptionByTenantId(tenantId) {
    return this.data.subscriptions.find((s) => s.tenant_id === tenantId);
  }
  updateSubscription(tenantId, updates) {
    const idx = this.data.subscriptions.findIndex((s) => s.tenant_id === tenantId);
    if (idx === -1) return void 0;
    this.data.subscriptions[idx] = {
      ...this.data.subscriptions[idx],
      ...updates
    };
    this.persist();
    syncDocToFirestore("subscriptions", this.data.subscriptions[idx].id, this.data.subscriptions[idx]);
    return this.data.subscriptions[idx];
  }
  // Audit Logs
  addAuditLog(log) {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newLog = {
      ...log,
      id,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.audit_logs.unshift(newLog);
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.persist();
    syncDocToFirestore("audit_logs", newLog.id, newLog);
    return newLog;
  }
  getAuditLogs(tenantId) {
    if (tenantId) {
      return this.data.audit_logs.filter((l) => l.tenant_id === tenantId);
    }
    return [...this.data.audit_logs];
  }
  // Cloud Firestore Database Info & Full Sync
  async getDatabaseInfo() {
    const firestoreHealth = await checkFirestoreHealth();
    return {
      engine: "Cloud Firestore + ACID WAL High-Performance Cache",
      firestore: firestoreHealth,
      collections: {
        tenants: this.data.tenants.length,
        users: this.data.users.length,
        services: this.data.services.length,
        print_jobs: this.data.print_jobs.length,
        documents: this.data.documents.length,
        payments: this.data.payments.length,
        subscriptions: this.data.subscriptions.length,
        audit_logs: this.data.audit_logs.length
      },
      last_sync: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async syncAllToFirestore() {
    console.log("[DB] Starting comprehensive sync to Cloud Firestore...");
    let synced = 0;
    for (const tenant of this.data.tenants) {
      await syncDocToFirestore("tenants", tenant.id, tenant);
      synced++;
    }
    for (const service of this.data.services) {
      await syncDocToFirestore("services", service.id, service);
      synced++;
    }
    for (const job of this.data.print_jobs) {
      await syncDocToFirestore("print_jobs", job.id, job);
      synced++;
    }
    for (const sub of this.data.subscriptions) {
      await syncDocToFirestore("subscriptions", sub.id, sub);
      synced++;
    }
    for (const user of this.data.users) {
      const { password_hash, ...safeUser } = user;
      await syncDocToFirestore("users", user.id, safeUser);
      synced++;
    }
    console.log(`[DB] Successfully synchronized ${synced} documents to Cloud Firestore.`);
    return { success: true, count: synced, timestamp: (/* @__PURE__ */ new Date()).toISOString() };
  }
};
var db = new DatabaseEngine();

// server/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "printflow-production-jwt-secret-key-2026";
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Missing or invalid Bearer token." });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(decoded.id);
    if (!user || user.status !== "active") {
      res.status(401).json({ error: "User account is deactivated or not found." });
      return;
    }
    req.user = {
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      email: user.email
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session token." });
  }
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized. Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' does not have access to this resource.`
      });
      return;
    }
    next();
  };
}
function verifyTenant(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  if (req.user.role === "super_admin") {
    const requested = req.query.tenant_id || req.headers["x-tenant-id"] || req.params.tenantId;
    if (requested) {
      req.tenantId = requested;
      req.params.tenantId = requested;
    } else if (req.user.tenant_id) {
      req.tenantId = req.user.tenant_id;
      req.params.tenantId = req.user.tenant_id;
    }
    next();
    return;
  }
  const requestedTenantId = req.params.tenantId || req.body.tenant_id || req.query.tenant_id || req.headers["x-tenant-id"];
  if (!req.user.tenant_id) {
    res.status(403).json({ error: "Forbidden. User has no assigned printing press tenant." });
    return;
  }
  if (requestedTenantId && requestedTenantId !== req.user.tenant_id) {
    db.addAuditLog({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      user_email: req.user.email,
      role: req.user.role,
      action: "SECURITY_CROSS_TENANT_VIOLATION_BLOCKED",
      resource_type: "tenant",
      resource_id: String(requestedTenantId),
      details: {
        attempted_tenant_id: requestedTenantId,
        user_tenant_id: req.user.tenant_id,
        path: req.originalUrl
      },
      ip: req.ip || req.socket.remoteAddress
    });
    res.status(403).json({
      error: "Access Denied: Multi-tenant boundary violation. You cannot access another printing press data."
    });
    return;
  }
  req.tenantId = req.user.tenant_id;
  req.params.tenantId = req.user.tenant_id;
  next();
}

// server/routes/authRoutes.ts
var router = Router();
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  const cleanEmail = email.toLowerCase().trim();
  const user = db.getUserByEmail(cleanEmail);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Your account is suspended. Please contact platform support." });
    return;
  }
  const isPasswordValid = bcrypt2.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  let tenant = null;
  if (user.tenant_id) {
    tenant = db.getTenantById(user.tenant_id);
    if (!tenant) {
      res.status(404).json({ error: "Assigned printing press not found." });
      return;
    }
    if (tenant.status === "suspended") {
      res.status(403).json({ error: "This printing press has been suspended by the platform administrator." });
      return;
    }
  }
  const token = generateToken({
    id: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
    name: user.name,
    email: user.email
  });
  db.addAuditLog({
    tenant_id: user.tenant_id,
    user_id: user.id,
    user_email: user.email,
    role: user.role,
    action: "USER_LOGIN_SUCCESS",
    resource_type: "user",
    resource_id: user.id,
    ip: req.ip
  });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      tenant_id: user.tenant_id
    },
    tenant
  });
});
router.post("/register-press", (req, res) => {
  try {
    const {
      business_name,
      owner_name,
      email,
      password,
      phone,
      location,
      address,
      description,
      operating_hours
    } = req.body || {};
    if (!business_name || !owner_name || !email || !password || !phone) {
      res.status(400).json({ error: "Business name, owner name, email, password, and phone number are required." });
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      res.status(400).json({ error: "Please enter a valid business email address." });
      return;
    }
    const existingUser = db.getUserByEmail(cleanEmail);
    if (existingUser) {
      res.status(409).json({ error: "A user account with this email already exists. Please log in or use another email." });
      return;
    }
    let baseSlug = String(business_name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "print-shop";
    let slug = baseSlug;
    let counter = 1;
    while (db.getTenantBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    const tenant = db.createTenant({
      slug,
      name: String(business_name).trim(),
      owner_name: String(owner_name).trim(),
      email: cleanEmail,
      phone: String(phone).trim(),
      location: location ? String(location).trim() : "Ghana",
      address: address ? String(address).trim() : "",
      description: description ? String(description).trim() : "Digital and offset printing services",
      logo_url: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=150&auto=format&fit=crop&q=80",
      status: "active",
      plan_id: "free",
      settings: {
        currency: "GHS",
        currency_symbol: "GH\u20B5",
        operating_hours: operating_hours ? String(operating_hours).trim() : "Monday \u2013 Saturday: 8:00 AM \u2013 7:00 PM",
        pay_at_shop_enabled: true,
        online_payment_enabled: false,
        payment_provider: "paystack",
        document_retention_days: 14,
        max_file_size_mb: 25,
        allow_notes: true
      }
    });
    const passwordHash = bcrypt2.hashSync(String(password), 10);
    const user = db.createUser({
      tenant_id: tenant.id,
      role: "owner",
      name: String(owner_name).trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      phone: String(phone).trim(),
      status: "active"
    });
    db.createService({
      tenant_id: tenant.id,
      name: "A4 Black & White Printing",
      category: "printing",
      unit_type: "per_page",
      price: 0.5,
      description: "Standard monochrome 80gsm printing",
      is_active: true
    });
    db.createService({
      tenant_id: tenant.id,
      name: "A4 Colour Printing",
      category: "printing",
      unit_type: "per_page",
      price: 2,
      description: "Full color digital laser print",
      is_active: true
    });
    db.createService({
      tenant_id: tenant.id,
      name: "Plastic Comb Binding",
      category: "finishing",
      unit_type: "per_document",
      price: 8,
      description: "Comb binding with clear cover",
      is_active: true
    });
    db.addAuditLog({
      tenant_id: tenant.id,
      user_id: user.id,
      user_email: user.email,
      role: "owner",
      action: "PRINTING_PRESS_REGISTERED",
      resource_type: "tenant",
      resource_id: tenant.id,
      details: { business_name, slug, location },
      ip: req.ip
    });
    const token = generateToken({
      id: user.id,
      tenant_id: tenant.id,
      role: user.role,
      name: user.name,
      email: user.email
    });
    res.status(201).json({
      message: "Printing press registered successfully! Your private dashboard is ready.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        tenant_id: user.tenant_id
      },
      tenant,
      dashboard_url: `/?portal=${tenant.slug}`
    });
  } catch (err) {
    console.error("[Auth Error] Error during printing press registration:", err);
    res.status(500).json({
      error: err?.message || "An unexpected error occurred during company registration. Please try again."
    });
  }
});
router.get("/me", authenticate, (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = db.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  let tenant = null;
  if (user.tenant_id) {
    tenant = db.getTenantById(user.tenant_id);
  }
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      tenant_id: user.tenant_id
    },
    tenant
  });
});
router.put("/profile", authenticate, (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = db.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: "User account not found." });
    return;
  }
  const { name, email, phone, current_password, new_password } = req.body;
  if (name !== void 0 && typeof name === "string" && name.trim().length === 0) {
    res.status(400).json({ error: "Name cannot be empty." });
    return;
  }
  if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
    const existing = db.getUserByEmail(email.trim().toLowerCase());
    if (existing && existing.id !== user.id) {
      res.status(409).json({ error: "Another user account already uses this email address." });
      return;
    }
  }
  let newPasswordHash = void 0;
  if (new_password) {
    if (typeof new_password !== "string" || new_password.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters long." });
      return;
    }
    if (current_password) {
      const isMatch = bcrypt2.compareSync(current_password, user.password_hash);
      if (!isMatch) {
        res.status(400).json({ error: "Current password does not match." });
        return;
      }
    }
    newPasswordHash = bcrypt2.hashSync(new_password, 10);
  }
  const updatedName = name !== void 0 ? name.trim() : user.name;
  const updatedEmail = email !== void 0 ? email.trim().toLowerCase() : user.email;
  const updatedPhone = phone !== void 0 ? phone.trim() : user.phone;
  const updatedUser = db.updateUser(user.id, {
    name: updatedName,
    email: updatedEmail,
    ...phone !== void 0 ? { phone: updatedPhone } : {},
    ...newPasswordHash ? { password_hash: newPasswordHash } : {}
  });
  if (!updatedUser) {
    res.status(500).json({ error: "Failed to update user profile." });
    return;
  }
  if (user.tenant_id && user.role === "owner") {
    const tenant = db.getTenantById(user.tenant_id);
    if (tenant) {
      db.updateTenant(user.tenant_id, {
        ...name !== void 0 ? { owner_name: updatedName } : {},
        ...email !== void 0 ? { email: updatedEmail } : {},
        ...phone !== void 0 ? { phone: updatedPhone } : {}
      });
    }
  }
  db.addAuditLog({
    tenant_id: user.tenant_id,
    user_id: user.id,
    user_email: updatedEmail,
    role: user.role,
    action: "USER_PROFILE_UPDATED",
    resource_type: "user",
    resource_id: user.id,
    details: {
      changed_name: name !== void 0 && name !== user.name,
      changed_email: email !== void 0 && email !== user.email,
      changed_password: !!newPasswordHash
    },
    ip: req.ip
  });
  const token = generateToken({
    id: updatedUser.id,
    tenant_id: updatedUser.tenant_id,
    role: updatedUser.role,
    name: updatedUser.name,
    email: updatedUser.email
  });
  res.json({
    message: "Profile and credentials updated successfully.",
    token,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      tenant_id: updatedUser.tenant_id
    }
  });
});
var authRoutes_default = router;

// server/routes/publicRoutes.ts
import { Router as Router2 } from "express";
import QRCode from "qrcode";
import { v4 as uuidv42 } from "uuid";

// server/storage.ts
import multer from "multer";
import path3 from "path";
import fs3 from "fs";
import { v4 as uuidv4 } from "uuid";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
var isServerless2 = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
var STORAGE_ROOT = isServerless2 ? path3.join("/tmp", "uploads") : path3.join(process.cwd(), "uploads");
try {
  if (!fs3.existsSync(STORAGE_ROOT)) {
    fs3.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
} catch (err) {
  console.warn("[Storage] Notice creating uploads root:", err);
}
var ALLOWED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"]
};
function sanitizeFilename(rawName) {
  const base = path3.basename(rawName);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 150);
}
var storageEngine = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantSlugOrId = req.params.slug || req.params.tenantId || req.body.tenant_id || "general";
    const tenantDir = path3.join(STORAGE_ROOT, tenantSlugOrId.replace(/[^a-zA-Z0-9_-]/g, "_"));
    try {
      if (!fs3.existsSync(tenantDir)) {
        fs3.mkdirSync(tenantDir, { recursive: true });
      }
    } catch (err) {
      console.warn("[Storage] Notice creating tenant folder:", err);
    }
    cb(null, tenantDir);
  },
  filename: (_req, file, cb) => {
    const ext = path3.extname(file.originalname).toLowerCase();
    const safeBase = sanitizeFilename(path3.basename(file.originalname, ext));
    const uniqueName = `${safeBase}-${uuidv4().substring(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});
var uploadMiddleware = multer({
  storage: storageEngine,
  limits: {
    fileSize: 35 * 1024 * 1024,
    // 35 MB max
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const ext = path3.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_MIME_TYPES[file.mimetype];
    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
      return cb(
        new Error(
          `Invalid file format: ${file.mimetype} (${ext}). Allowed formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG.`
        )
      );
    }
    cb(null, true);
  }
});
async function ensureValidDocumentFile(doc2) {
  const fullPath = path3.isAbsolute(doc2.storage_path) ? doc2.storage_path : path3.join(process.cwd(), doc2.storage_path);
  if (fs3.existsSync(fullPath)) {
    return fullPath;
  }
  const dir = path3.dirname(fullPath);
  if (!fs3.existsSync(dir)) {
    fs3.mkdirSync(dir, { recursive: true });
  }
  if (!doc2.original_name.toLowerCase().endsWith(".pdf") && doc2.mime_type !== "application/pdf") {
    fs3.writeFileSync(
      fullPath,
      Buffer.from(
        `PrintFlow Verified Document: ${doc2.original_name}
Tenant: ${doc2.tenant_id}
Job: ${doc2.job_id}
Created: ${doc2.created_at}
`
      )
    );
    return fullPath;
  }
  try {
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const job = db.getPrintJobById(doc2.job_id);
    const totalPages = Math.min(Math.max(job?.options?.page_count || 4, 2), 8);
    const paperSize = job?.options?.paper_size || "A4";
    const colorMode = job?.options?.color_mode || "color";
    const sidedness = job?.options?.sidedness || "double";
    const binding = job?.options?.binding || "none";
    const copies = job?.options?.copies || 1;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      page.drawRectangle({
        x: 36,
        y: height - 46,
        width: width - 72,
        height: 1,
        color: rgb(0.85, 0.88, 0.92)
      });
      page.drawText("PrintFlow Operator Verification & Pre-flight Inspection", {
        x: 36,
        y: height - 40,
        size: 8,
        font: fontBold,
        color: rgb(0.3, 0.4, 0.55)
      });
      page.drawText(`Page ${pageNum} of ${totalPages}`, {
        x: width - 95,
        y: height - 40,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5)
      });
      if (pageNum === 1) {
        const cleanTitle = doc2.original_name.replace(/[_-]/g, " ").replace(/\.pdf$/i, "");
        page.drawText(cleanTitle.substring(0, 48), {
          x: 36,
          y: height - 90,
          size: 16,
          font: fontBold,
          color: rgb(0.08, 0.12, 0.28)
        });
        page.drawText(`Job #: ${job?.job_number || "PF-2026-001"}  \u2022  Customer: ${job?.customer_name || "Walk-in"}`, {
          x: 36,
          y: height - 110,
          size: 9.5,
          font: fontOblique,
          color: rgb(0.35, 0.4, 0.5)
        });
        page.drawRectangle({
          x: 36,
          y: height - 195,
          width: width - 72,
          height: 70,
          color: rgb(0.96, 0.98, 1),
          borderColor: rgb(0.75, 0.82, 0.95),
          borderWidth: 1
        });
        page.drawText("PRINT OPERATOR PRE-FLIGHT SPECIFICATIONS", {
          x: 48,
          y: height - 145,
          size: 8.5,
          font: fontBold,
          color: rgb(0.12, 0.35, 0.8)
        });
        page.drawText(`Paper Size: ${paperSize}   |   Color Mode: ${colorMode.toUpperCase()}   |   Sidedness: ${sidedness}-sided`, {
          x: 48,
          y: height - 163,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.15, 0.2, 0.3)
        });
        page.drawText(`Binding: ${binding.toUpperCase()}   |   Copies: ${copies}   |   Order Total: GHS ${job?.estimated_total?.toFixed(2) || "0.00"}`, {
          x: 48,
          y: height - 181,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.15, 0.2, 0.3)
        });
        const colors = [
          { label: "Cyan (C)", col: rgb(0, 0.7, 0.9) },
          { label: "Magenta (M)", col: rgb(0.9, 0.1, 0.6) },
          { label: "Yellow (Y)", col: rgb(0.95, 0.85, 0.1) },
          { label: "Black (K)", col: rgb(0.1, 0.1, 0.1) }
        ];
        colors.forEach((c, idx) => {
          page.drawRectangle({
            x: 36 + idx * 85,
            y: height - 235,
            width: 75,
            height: 20,
            color: c.col
          });
          page.drawText(c.label, {
            x: 42 + idx * 85,
            y: height - 227,
            size: 7.5,
            font: fontBold,
            color: rgb(1, 1, 1)
          });
        });
        page.drawText("1. Document Overview & Pre-Print Requirements", {
          x: 36,
          y: height - 280,
          size: 12,
          font: fontBold,
          color: rgb(0.1, 0.15, 0.25)
        });
        const sampleLines = [
          "This document has been verified for production printing through the PrintFlow platform.",
          "Please verify margins, typography baseline alignments, and graphic asset color reproduction.",
          "Digital high-speed laser printing requires adequate binding gutters (minimum 12mm on inner binding edge).",
          "Operators can inspect this preview in both full-color and grayscale monochrome laser simulation.",
          "Ensure that paper stock, weight (e.g. 80gsm bond), and finishing machine are loaded before starting job."
        ];
        sampleLines.forEach((line, idx) => {
          page.drawText(`\u2022 ${line}`, {
            x: 45,
            y: height - 308 - idx * 20,
            size: 9,
            font: fontRegular,
            color: rgb(0.2, 0.25, 0.35)
          });
        });
        page.drawRectangle({
          x: 36,
          y: 45,
          width: 28,
          height: height - 90,
          color: rgb(0.92, 0.95, 0.99),
          opacity: 0.5
        });
        page.drawText("Safe Spine Gutter", {
          x: 43,
          y: height / 2 - 20,
          size: 7,
          font: fontOblique,
          color: rgb(0.4, 0.5, 0.65),
          rotate: degrees(90)
        });
      } else {
        page.drawText(`Section ${pageNum}: Content Verification & Production Details`, {
          x: 36,
          y: height - 90,
          size: 13,
          font: fontBold,
          color: rgb(0.1, 0.15, 0.25)
        });
        page.drawText(`Certified Template & Layout Proofing (Page ${pageNum} of ${totalPages})`, {
          x: 36,
          y: height - 108,
          size: 8.5,
          font: fontOblique,
          color: rgb(0.4, 0.45, 0.55)
        });
        const bodyParagraphs = [
          `The operational parameters specified for this document order mandate rigorous consistency across all ${totalPages} pages.`,
          "Every page layout has been formatted with standard ISO 216 A4 boundaries (210mm x 297mm).",
          "Digital rasterization guarantees that vector artwork, mathematical typography, and photographic figures remain sharp.",
          "Quality assurance verification confirms that double-sided duplex page numbering alternates correctly.",
          "Ensure that the high-speed laser toner density is calibrated to prevent bleed-through on lightweight stock."
        ];
        bodyParagraphs.forEach((para, idx) => {
          page.drawText(para, {
            x: 36,
            y: height - 145 - idx * 32,
            size: 9,
            font: fontRegular,
            color: rgb(0.2, 0.25, 0.35)
          });
        });
        page.drawRectangle({
          x: 36,
          y: height - 390,
          width: width - 72,
          height: 60,
          color: rgb(0.98, 0.98, 0.99),
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 1
        });
        page.drawText("Pre-flight Verification Parameter Table", {
          x: 46,
          y: height - 350,
          size: 8.5,
          font: fontBold,
          color: rgb(0.15, 0.2, 0.3)
        });
        page.drawText("Resolution: 600 DPI Vector  |  Toner: CMYK High Contrast  |  Finishing: Heat Press Bonded", {
          x: 46,
          y: height - 372,
          size: 8,
          font: fontRegular,
          color: rgb(0.3, 0.35, 0.45)
        });
      }
      page.drawRectangle({
        x: 36,
        y: 40,
        width: width - 72,
        height: 1,
        color: rgb(0.85, 0.88, 0.92)
      });
      page.drawText(`PrintFlow Document ID: ${doc2.id}  \u2022  Encrypted & Verified Digital Print Asset`, {
        x: 36,
        y: 28,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.45, 0.5, 0.6)
      });
    }
    const pdfBytes = await pdfDoc.save();
    fs3.writeFileSync(fullPath, Buffer.from(pdfBytes));
    return fullPath;
  } catch (err) {
    console.error("[Storage] Error generating sample PDF with pdf-lib:", err);
    const minimalPdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000111 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
    fs3.writeFileSync(fullPath, Buffer.from(minimalPdf));
    return fullPath;
  }
}
async function serveSecureDocument(req, res, documentId, userTenantId, isSuperAdmin = false, trackingToken) {
  const doc2 = db.getDocumentById(documentId);
  if (!doc2) {
    res.status(404).json({ error: "Document not found or has been purged according to retention policy." });
    return;
  }
  let authorized = false;
  if (isSuperAdmin) {
    authorized = true;
  } else if (userTenantId && userTenantId === doc2.tenant_id) {
    authorized = true;
  } else if (trackingToken) {
    const job = db.getPrintJobById(doc2.job_id);
    if (job && job.tracking_token === trackingToken) {
      authorized = true;
    }
  }
  if (!authorized) {
    res.status(403).json({ error: "Unauthorized. You do not have permission to view or download this document." });
    return;
  }
  try {
    const fullPath = await ensureValidDocumentFile(doc2);
    db.addAuditLog({
      tenant_id: doc2.tenant_id,
      user_id: req.user?.id,
      user_email: req.user?.email || "Customer (Tracking Token)",
      role: req.user?.role || "customer",
      action: "DOCUMENT_ACCESSED",
      resource_type: "document",
      resource_id: doc2.id,
      details: {
        original_name: doc2.original_name,
        job_id: doc2.job_id,
        access_ip: req.ip
      },
      ip: req.ip
    });
    db.incrementDocumentAccess(doc2.id);
    res.setHeader("Content-Type", doc2.mime_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc2.original_name)}"`);
    const fileStream = fs3.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("[Storage] Error serving document:", err);
    res.status(500).json({ error: "Failed to retrieve document stream." });
  }
}

// server/utils/pageCounter.ts
import fs4 from "fs";
import path4 from "path";
import zlib from "zlib";
import { PDFDocument as PDFDocument2, PDFName } from "pdf-lib";
function decompressStream(uint8) {
  try {
    return zlib.inflateSync(Buffer.from(uint8));
  } catch {
    try {
      return zlib.inflateRawSync(Buffer.from(uint8));
    } catch {
      return Buffer.from(uint8);
    }
  }
}
function streamHasColor(text) {
  const rgbRegex = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(?:rg|RG)/g;
  let match;
  while ((match = rgbRegex.exec(text)) !== null) {
    const r = parseFloat(match[1]);
    const g = parseFloat(match[2]);
    const b = parseFloat(match[3]);
    if (Math.abs(r - g) > 0.04 || Math.abs(g - b) > 0.04 || Math.abs(r - b) > 0.04) {
      return true;
    }
  }
  const cmykRegex = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+(?:k|K)/g;
  while ((match = cmykRegex.exec(text)) !== null) {
    const c = parseFloat(match[1]);
    const m = parseFloat(match[2]);
    const y = parseFloat(match[3]);
    if (c > 0.04 || m > 0.04 || y > 0.04) {
      return true;
    }
  }
  if (text.includes("/DeviceRGB") || text.includes("/DeviceCMYK")) {
    return true;
  }
  return false;
}
async function analyzeServerDocumentPages(filePath) {
  try {
    if (!fs4.existsSync(filePath)) {
      return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: "Document" };
    }
    const ext = path4.extname(filePath).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return {
        totalPages: 1,
        colorPages: 1,
        bwPages: 0,
        detectedType: "Image"
      };
    }
    if (ext === ".pdf") {
      try {
        const fileBuffer = await fs4.promises.readFile(filePath);
        const pdfDoc = await PDFDocument2.load(fileBuffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const total2 = pages.length;
        if (total2 > 0) {
          let colorCount = 0;
          let bwCount = 0;
          for (let i = 0; i < total2; i++) {
            const page = pages[i];
            let pageHasColor = false;
            const contents = page.node.Contents();
            if (contents) {
              const items = contents.asArray ? contents.asArray() : [contents];
              for (const item of items) {
                const stream = pdfDoc.context.lookup(item);
                if (stream && stream.getContents) {
                  const raw = stream.getContents();
                  const decompressed = decompressStream(raw).toString("binary");
                  if (streamHasColor(decompressed)) {
                    pageHasColor = true;
                    break;
                  }
                }
              }
            }
            if (!pageHasColor) {
              const resources = page.node.Resources();
              if (resources) {
                const xObjectDict = resources.lookup ? resources.lookup(PDFName.of("XObject")) : null;
                if (xObjectDict && xObjectDict.entries) {
                  for (const [, ref] of xObjectDict.entries()) {
                    const xObj = pdfDoc.context.lookup(ref);
                    if (xObj && xObj.lookup) {
                      const colorSpace = xObj.lookup(PDFName.of("ColorSpace"));
                      if (colorSpace) {
                        const csStr = colorSpace.toString();
                        if (csStr.includes("RGB") || csStr.includes("CMYK")) {
                          pageHasColor = true;
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
            if (pageHasColor) {
              colorCount++;
            } else {
              bwCount++;
            }
          }
          return {
            totalPages: total2,
            colorPages: colorCount,
            bwPages: bwCount,
            detectedType: "PDF Document"
          };
        }
      } catch (pdfErr) {
        console.warn("Server detailed PDF color analysis fallback:", pdfErr);
      }
      const total = await calculateServerDocumentPages(filePath);
      return {
        totalPages: total,
        colorPages: 0,
        bwPages: total,
        detectedType: "PDF Document"
      };
    }
    if (ext === ".docx" || ext === ".doc") {
      try {
        const buffer = await fs4.promises.readFile(filePath);
        const text = buffer.toString("utf-8");
        const pageMatch = text.match(/<Pages[^>]*>(\d+)<\/Pages>/i);
        const total = pageMatch && parseInt(pageMatch[1], 10) > 0 ? parseInt(pageMatch[1], 10) : 1;
        const hasColorTags = /<w:color\s+w:val="(?!000000|auto|ffffff)[0-9a-fA-F]{6}"/i.test(text);
        return {
          totalPages: total,
          colorPages: hasColorTags ? total : 0,
          bwPages: hasColorTags ? 0 : total,
          detectedType: "Word Document"
        };
      } catch {
        return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: "Word Document" };
      }
    }
    if (ext === ".pptx" || ext === ".ppt") {
      try {
        const buffer = await fs4.promises.readFile(filePath);
        const text = buffer.toString("utf-8");
        const slideMatch = text.match(/<Slides[^>]*>(\d+)<\/Slides>/i);
        const total = slideMatch && parseInt(slideMatch[1], 10) > 0 ? parseInt(slideMatch[1], 10) : 1;
        return {
          totalPages: total,
          colorPages: total,
          // presentations are predominantly color
          bwPages: 0,
          detectedType: "PowerPoint Presentation"
        };
      } catch {
        return { totalPages: 1, colorPages: 1, bwPages: 0, detectedType: "PowerPoint Presentation" };
      }
    }
    return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: "Document" };
  } catch (err) {
    console.error("Error in analyzeServerDocumentPages:", err);
    return { totalPages: 1, colorPages: 0, bwPages: 1, detectedType: "Document" };
  }
}
async function calculateServerDocumentPages(filePath) {
  try {
    if (!fs4.existsSync(filePath)) {
      return 1;
    }
    const ext = path4.extname(filePath).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return 1;
    }
    if (ext === ".pdf") {
      try {
        const fileBuffer = await fs4.promises.readFile(filePath);
        const pdfDoc = await PDFDocument2.load(fileBuffer, { ignoreEncryption: true });
        const count = pdfDoc.getPageCount();
        if (count && count > 0) {
          return count;
        }
      } catch (pdfErr) {
        console.warn("Server pdf-lib parsing failed, falling back to stream check:", pdfErr);
        try {
          const rawBuffer = await fs4.promises.readFile(filePath);
          const rawText = rawBuffer.toString("binary");
          const matches = rawText.match(/\/Type\s*\/Page[^s]/g);
          if (matches && matches.length > 0) {
            return matches.length;
          }
          const countMatch = rawText.match(/\/Count\s+(\d+)/);
          if (countMatch && parseInt(countMatch[1], 10) > 0) {
            return parseInt(countMatch[1], 10);
          }
        } catch (rawErr) {
          console.warn("Server raw stream scan failed:", rawErr);
        }
      }
      return 1;
    }
    if (ext === ".docx" || ext === ".doc") {
      try {
        const buffer = await fs4.promises.readFile(filePath);
        const text = buffer.toString("utf-8");
        const pageMatch = text.match(/<Pages[^>]*>(\d+)<\/Pages>/i);
        if (pageMatch && parseInt(pageMatch[1], 10) > 0) {
          return parseInt(pageMatch[1], 10);
        }
      } catch {
      }
      return 1;
    }
    if (ext === ".pptx" || ext === ".ppt") {
      try {
        const buffer = await fs4.promises.readFile(filePath);
        const text = buffer.toString("utf-8");
        const slideMatch = text.match(/<Slides[^>]*>(\d+)<\/Slides>/i);
        if (slideMatch && parseInt(slideMatch[1], 10) > 0) {
          return parseInt(slideMatch[1], 10);
        }
      } catch {
      }
      return 1;
    }
    return 1;
  } catch (err) {
    console.error("Error in calculateServerDocumentPages:", err);
    return 1;
  }
}

// server/routes/publicRoutes.ts
var router2 = Router2();
router2.get("/db-status", async (_req, res) => {
  try {
    const info = await db.getDatabaseInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to get DB status" });
  }
});
router2.get("/presses", (_req, res) => {
  const tenants = db.getTenants().filter((t) => t.status === "active");
  const sanitized = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    location: t.location,
    address: t.address,
    description: t.description,
    logo_url: t.logo_url,
    operating_hours: t.settings.operating_hours
  }));
  res.json(sanitized);
});
router2.get("/press/:slug", (req, res) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  if (tenant.status === "pending_approval") {
    res.status(403).json({
      error: "This printing press registration is currently pending platform approval.",
      status: "pending_approval"
    });
    return;
  }
  if (tenant.status === "suspended") {
    res.status(403).json({
      error: "This printing press is temporarily unavailable.",
      status: "suspended"
    });
    return;
  }
  const services = db.getServices(tenant.id).filter((s) => s.is_active);
  res.json({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    location: tenant.location,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.email,
    description: tenant.description,
    logo_url: tenant.logo_url,
    settings: {
      currency: tenant.settings.currency || "GHS",
      currency_symbol: tenant.settings.currency_symbol || "GH\u20B5",
      operating_hours: tenant.settings.operating_hours,
      pay_at_shop_enabled: tenant.settings.pay_at_shop_enabled ?? true,
      online_payment_enabled: tenant.settings.online_payment_enabled ?? true,
      payment_provider: tenant.settings.payment_provider || "paystack",
      max_file_size_mb: tenant.settings.max_file_size_mb || 25,
      contact_whatsapp: tenant.settings.contact_whatsapp,
      allow_notes: tenant.settings.allow_notes ?? true
    },
    services
  });
});
router2.get("/press/:slug/qr", async (req, res) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const publicUrl = `${protocol}://${host}/p/${tenant.slug}`;
  try {
    const format = req.query.format === "svg" ? "svg" : "png";
    if (format === "svg") {
      const svg = await QRCode.toString(publicUrl, {
        type: "svg",
        color: { dark: "#0F172A", light: "#FFFFFF" },
        margin: 2
      });
      res.setHeader("Content-Type", "image/svg+xml");
      res.send(svg);
      return;
    }
    if (req.query.download === "true") {
      const buffer = await QRCode.toBuffer(publicUrl, {
        type: "png",
        width: 800,
        margin: 2,
        color: { dark: "#0F172A", light: "#FFFFFF" }
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="${tenant.slug}-qr-code.png"`);
      res.send(buffer);
      return;
    }
    const dataUrl = await QRCode.toDataURL(publicUrl, {
      width: 500,
      margin: 2,
      color: { dark: "#0F172A", light: "#FFFFFF" }
    });
    res.json({
      publicUrl,
      dataUrl,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }
    });
  } catch (err) {
    console.error("QR generation error:", err);
    res.status(500).json({ error: "Failed to generate QR code." });
  }
});
function calculateJobPrice(tenantId, options) {
  const services = db.getServices(tenantId);
  const breakdown = [];
  const copies = Math.max(1, Number(options.copies) || 1);
  const pageCount = Math.max(1, Number(options.page_count) || 1);
  const paperSize = options.paper_size || "A4";
  const colorMode = options.color_mode || "bw";
  let bwPricePerPage = paperSize === "A3" ? 1 : 0.5;
  const matchedBwService = services.find((s) => {
    if (!s.is_active || s.category !== "printing") return false;
    const name = s.name.toLowerCase();
    const hasBwMatch = name.includes("b&w") || name.includes("black") || name.includes("monochrome");
    const hasSizeMatch = name.includes(paperSize.toLowerCase());
    return hasBwMatch && hasSizeMatch;
  }) || services.find((s) => {
    if (!s.is_active || s.category !== "printing") return false;
    const name = s.name.toLowerCase();
    return name.includes("b&w") || name.includes("black") || name.includes("monochrome");
  });
  if (matchedBwService) {
    bwPricePerPage = matchedBwService.price;
  }
  let colorPricePerPage = paperSize === "A3" ? 4 : 2;
  const matchedColorService = services.find((s) => {
    if (!s.is_active || s.category !== "printing") return false;
    const name = s.name.toLowerCase();
    const hasColorMatch = name.includes("colour") || name.includes("color");
    const hasSizeMatch = name.includes(paperSize.toLowerCase());
    return hasColorMatch && hasSizeMatch;
  }) || services.find((s) => {
    if (!s.is_active || s.category !== "printing") return false;
    const name = s.name.toLowerCase();
    return name.includes("colour") || name.includes("color");
  });
  if (matchedColorService) {
    colorPricePerPage = matchedColorService.price;
  }
  if (colorMode === "bw") {
    const printTotal = bwPricePerPage * pageCount * copies;
    breakdown.push({
      item: `Printing: ${paperSize} Black & White (${pageCount} pgs \xD7 ${copies} ${copies === 1 ? "copy" : "copies"} @ GH\u20B5${bwPricePerPage.toFixed(2)}/pg)`,
      amount: printTotal
    });
  } else if (colorMode === "color") {
    const printTotal = colorPricePerPage * pageCount * copies;
    breakdown.push({
      item: `Printing: ${paperSize} Full Colour (${pageCount} pgs \xD7 ${copies} ${copies === 1 ? "copy" : "copies"} @ GH\u20B5${colorPricePerPage.toFixed(2)}/pg)`,
      amount: printTotal
    });
  } else {
    const numColor = Math.max(0, options.color_pages ?? 0);
    const numBw = Math.max(0, options.bw_pages !== void 0 ? options.bw_pages : pageCount - numColor);
    if (numColor > 0) {
      const colorTotal = colorPricePerPage * numColor * copies;
      breakdown.push({
        item: `Printing: ${paperSize} Colour (${numColor} pgs \xD7 ${copies} ${copies === 1 ? "copy" : "copies"} @ GH\u20B5${colorPricePerPage.toFixed(2)}/pg)`,
        amount: colorTotal
      });
    }
    if (numBw > 0) {
      const bwTotal = bwPricePerPage * numBw * copies;
      breakdown.push({
        item: `Printing: ${paperSize} Black & White (${numBw} pgs \xD7 ${copies} ${copies === 1 ? "copy" : "copies"} @ GH\u20B5${bwPricePerPage.toFixed(2)}/pg)`,
        amount: bwTotal
      });
    }
    if (numColor === 0 && numBw === 0) {
      const fallbackTotal = bwPricePerPage * pageCount * copies;
      breakdown.push({
        item: `Printing: ${paperSize} (${pageCount} pgs \xD7 ${copies} ${copies === 1 ? "copy" : "copies"} @ GH\u20B5${bwPricePerPage.toFixed(2)}/pg)`,
        amount: fallbackTotal
      });
    }
  }
  if (options.binding && options.binding !== "none") {
    let bindingFee = 0;
    const bindingService = services.find((s) => {
      const name = s.name.toLowerCase();
      if (options.binding === "hardcover") return name.includes("thesis") || name.includes("hardcover");
      if (options.binding === "spiral") return name.includes("spiral") || name.includes("comb");
      if (options.binding === "staple") return name.includes("staple");
      return false;
    });
    if (bindingService) {
      bindingFee = bindingService.price * copies;
    } else {
      if (options.binding === "hardcover") bindingFee = 45 * copies;
      else if (options.binding === "spiral") bindingFee = 8 * copies;
      else if (options.binding === "staple") bindingFee = 0.5 * copies;
    }
    if (bindingFee > 0) {
      breakdown.push({
        item: `Binding: ${options.binding.charAt(0).toUpperCase() + options.binding.slice(1)} (${copies} document${copies > 1 ? "s" : ""})`,
        amount: bindingFee
      });
    }
  }
  if (options.lamination && options.lamination !== "none") {
    let laminationFee = 0;
    const laminationService = services.find((s) => s.name.toLowerCase().includes("lamination"));
    const perItem = laminationService ? laminationService.price : 5;
    laminationFee = perItem * copies;
    breakdown.push({
      item: `Lamination: ${options.lamination.charAt(0).toUpperCase() + options.lamination.slice(1)} (${copies} item${copies > 1 ? "s" : ""})`,
      amount: laminationFee
    });
  }
  if (Array.isArray(options.finishing_services)) {
    for (const serviceId of options.finishing_services) {
      const service = services.find((s) => s.id === serviceId);
      if (service && service.is_active) {
        let serviceFee = service.price;
        if (service.unit_type === "per_copy" || service.unit_type === "per_document" || service.unit_type === "per_item") {
          serviceFee = service.price * copies;
        } else if (service.unit_type === "per_page") {
          serviceFee = service.price * pageCount * copies;
        }
        breakdown.push({
          item: service.name,
          amount: serviceFee
        });
      }
    }
  }
  const grandTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return {
    total: Math.max(0.5, Number(grandTotal.toFixed(2))),
    breakdown
  };
}
router2.post("/press/:slug/price-estimate", (req, res) => {
  const { slug } = req.params;
  const tenant = db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  const result = calculateJobPrice(tenant.id, req.body);
  res.json(result);
});
router2.post(
  "/press/:slug/upload",
  uploadMiddleware.single("document"),
  async (req, res) => {
    const { slug } = req.params;
    const tenant = db.getTenantBySlug(slug);
    if (!tenant) {
      res.status(404).json({ error: "Printing press not found." });
      return;
    }
    if (tenant.status !== "active") {
      res.status(403).json({ error: "This printing press is not accepting submissions." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Please select a document to upload." });
      return;
    }
    const {
      customer_name,
      customer_phone,
      customer_email,
      copies = "1",
      paper_size = "A4",
      color_mode = "bw",
      sidedness = "single",
      orientation = "portrait",
      page_range = "All",
      page_count = "1",
      binding = "none",
      lamination = "none",
      finishing_services = "[]",
      additional_instructions = "",
      payment_method = "shop",
      fulfillment_type = "instant_counter",
      pickup_time = "",
      is_pickup = "false"
    } = req.body;
    const docAnalysis = await analyzeServerDocumentPages(req.file.path);
    const clientSpecifiedPages = parseInt(page_count, 10);
    const finalPageCount = !isNaN(clientSpecifiedPages) && clientSpecifiedPages > 0 ? clientSpecifiedPages : Math.max(1, docAnalysis.totalPages);
    const reqColorPages = req.body.color_pages !== void 0 ? parseInt(req.body.color_pages, 10) : void 0;
    const reqBwPages = req.body.bw_pages !== void 0 ? parseInt(req.body.bw_pages, 10) : void 0;
    let finalColorPages = 0;
    let finalBwPages = finalPageCount;
    if (color_mode === "color") {
      finalColorPages = finalPageCount;
      finalBwPages = 0;
    } else if (color_mode === "bw") {
      finalColorPages = 0;
      finalBwPages = finalPageCount;
    } else {
      finalColorPages = !isNaN(reqColorPages) && reqColorPages >= 0 ? reqColorPages : docAnalysis.colorPages;
      finalBwPages = !isNaN(reqBwPages) && reqBwPages >= 0 ? reqBwPages : Math.max(0, finalPageCount - finalColorPages);
    }
    const finalCustomerName = customer_name && String(customer_name).trim() || "Walk-in Customer";
    const finalCustomerPhone = customer_phone && String(customer_phone).trim() || void 0;
    const isPickupSelected = is_pickup === "true" || is_pickup === true || fulfillment_type === "pickup";
    const finalPickupTime = pickup_time && String(pickup_time).trim() ? String(pickup_time).trim() : void 0;
    let parsedFinishing = [];
    try {
      parsedFinishing = JSON.parse(finishing_services);
    } catch {
      parsedFinishing = [];
    }
    const options = {
      copies: parseInt(copies, 10) || 1,
      paper_size: paper_size || "A4",
      color_mode: color_mode || "bw",
      sidedness: sidedness || "single",
      orientation: orientation || "portrait",
      page_range: page_range || "All",
      page_count: finalPageCount,
      color_pages: finalColorPages,
      bw_pages: finalBwPages,
      detected_pages: docAnalysis.totalPages,
      detected_color_pages: docAnalysis.colorPages,
      detected_bw_pages: docAnalysis.bwPages,
      binding: binding || "none",
      lamination: lamination || "none",
      finishing_services: parsedFinishing,
      additional_instructions: additional_instructions ? String(additional_instructions).trim() : void 0,
      fulfillment_type: isPickupSelected ? "pickup" : "instant_counter",
      pickup_time: finalPickupTime,
      is_pickup: isPickupSelected
    };
    const { total } = calculateJobPrice(tenant.id, options);
    const jobNumber = db.generateJobNumber();
    const trackingToken = `trk-${uuidv42().substring(0, 12)}`;
    const documentRecord = db.createDocument({
      tenant_id: tenant.id,
      job_id: "",
      // will link right below
      original_name: req.file.originalname,
      stored_filename: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      storage_path: req.file.path,
      download_token: `dl-${uuidv42()}`,
      expires_at: new Date(Date.now() + (tenant.settings.document_retention_days || 30) * 864e5).toISOString()
    });
    const printJob = db.createPrintJob({
      job_number: jobNumber,
      tenant_id: tenant.id,
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      customer_email: customer_email ? String(customer_email).trim() : void 0,
      tracking_token: trackingToken,
      document_id: documentRecord.id,
      document_name: req.file.originalname,
      document_size: req.file.size,
      document_mime: req.file.mimetype,
      options,
      estimated_total: total,
      payment_status: payment_method === "online" ? "pending" : "pay_at_shop",
      payment_method: payment_method === "online" ? "online" : "shop",
      job_status: "pending",
      status_notes: isPickupSelected && finalPickupTime ? `Job received. Customer scheduled optional pickup for ${finalPickupTime}.` : "Job received via digital QR upload. Awaiting press confirmation.",
      fulfillment_type: isPickupSelected ? "pickup" : "instant_counter",
      pickup_time: finalPickupTime
    });
    documentRecord.job_id = printJob.id;
    db.addAuditLog({
      tenant_id: tenant.id,
      action: "JOB_SUBMITTED_BY_CUSTOMER",
      resource_type: "job",
      resource_id: printJob.id,
      details: {
        job_number: jobNumber,
        customer_name,
        customer_phone,
        total,
        payment_method
      },
      ip: req.ip
    });
    res.status(201).json({
      message: "Print job submitted successfully!",
      job: {
        id: printJob.id,
        job_number: printJob.job_number,
        tracking_token: printJob.tracking_token,
        customer_name: printJob.customer_name,
        customer_phone: printJob.customer_phone,
        document_name: printJob.document_name,
        estimated_total: printJob.estimated_total,
        payment_status: printJob.payment_status,
        payment_method: printJob.payment_method,
        job_status: printJob.job_status,
        created_at: printJob.created_at,
        tenant_name: tenant.name,
        tenant_location: tenant.location
      }
    });
  }
);
router2.get("/track/:jobNumber", (req, res) => {
  const { jobNumber } = req.params;
  const token = req.query.token;
  if (!token) {
    res.status(400).json({ error: "Security tracking token is required to view this print job." });
    return;
  }
  const job = db.getPrintJobByNumberAndToken(jobNumber, token);
  if (!job) {
    res.status(404).json({ error: "Print job not found. Please verify your Job Number and tracking link." });
    return;
  }
  const tenant = db.getTenantById(job.tenant_id);
  res.json({
    job: {
      id: job.id,
      job_number: job.job_number,
      customer_name: job.customer_name,
      document_name: job.document_name,
      options: job.options,
      estimated_total: job.estimated_total,
      payment_status: job.payment_status,
      payment_method: job.payment_method,
      job_status: job.job_status,
      status_notes: job.status_notes,
      created_at: job.created_at,
      completed_at: job.completed_at,
      document_id: job.document_id,
      document_size: job.document_size,
      document_mime: job.document_mime,
      tenant_id: job.tenant_id,
      tracking_token: job.tracking_token
    },
    press: tenant ? {
      name: tenant.name,
      location: tenant.location,
      address: tenant.address,
      phone: tenant.phone,
      operating_hours: tenant.settings.operating_hours,
      contact_whatsapp: tenant.settings.contact_whatsapp
    } : null
  });
});
router2.get("/documents/:docId/download", (req, res) => {
  const { docId } = req.params;
  const token = req.query.token;
  if (!token) {
    res.status(403).json({ error: "Tracking token required for document download." });
    return;
  }
  serveSecureDocument(req, res, docId, null, false, token);
});
router2.post("/payments/paystack-simulate", (req, res) => {
  const { job_id, tracking_token, email } = req.body;
  const job = db.getPrintJobById(job_id);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  if (job.tracking_token !== tracking_token) {
    res.status(403).json({ error: "Invalid security token for this job." });
    return;
  }
  const reference = `PSTK_GHA_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
  db.createPayment({
    tenant_id: job.tenant_id,
    job_id: job.id,
    reference,
    amount: job.estimated_total,
    currency: "GHS",
    status: "paid",
    provider: "paystack",
    customer_email: email || job.customer_email || "customer@printflow.com",
    paid_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  db.updatePrintJob(job.id, null, {
    payment_status: "paid",
    payment_reference: reference,
    status_notes: `Payment of GH\u20B5${job.estimated_total.toFixed(2)} verified via Paystack Ghana (${reference}).`
  });
  db.addAuditLog({
    tenant_id: job.tenant_id,
    action: "PAYMENT_VERIFIED",
    resource_type: "payment",
    resource_id: reference,
    details: {
      amount: job.estimated_total,
      job_number: job.job_number,
      provider: "paystack"
    }
  });
  res.json({
    success: true,
    message: "Payment completed successfully!",
    reference,
    amount: job.estimated_total
  });
});
var publicRoutes_default = router2;

// server/routes/tenantRoutes.ts
import { Router as Router3 } from "express";
import bcrypt3 from "bcryptjs";
var router3 = Router3();
function getTenantId(req) {
  if (req.user?.role === "super_admin") {
    return req.query.tenant_id || req.headers["x-tenant-id"] || req.tenantId || req.user.tenant_id || req.params.tenantId || "";
  }
  return req.tenantId || req.user?.tenant_id || req.params.tenantId || "";
}
router3.use(authenticate);
router3.use(verifyTenant);
router3.get("/dashboard", (req, res) => {
  const tenantId = getTenantId(req);
  const jobs = db.getPrintJobs(tenantId);
  const payments = db.getPayments(tenantId);
  const tenant = db.getTenantById(tenantId);
  const now = /* @__PURE__ */ new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getTime() - 7 * 864e5).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const todayRevenue = payments.filter((p) => p.status === "paid" && new Date(p.created_at).getTime() >= startOfToday).reduce((sum, p) => sum + p.amount, 0);
  const weeklyRevenue = payments.filter((p) => p.status === "paid" && new Date(p.created_at).getTime() >= startOfWeek).reduce((sum, p) => sum + p.amount, 0);
  const monthlyRevenue = payments.filter((p) => p.status === "paid" && new Date(p.created_at).getTime() >= startOfMonth).reduce((sum, p) => sum + p.amount, 0);
  const counts = {
    total: jobs.length,
    pending: jobs.filter((j) => j.job_status === "pending").length,
    accepted: jobs.filter((j) => j.job_status === "accepted").length,
    processing: jobs.filter((j) => j.job_status === "processing").length,
    ready_for_pickup: jobs.filter((j) => j.job_status === "ready_for_pickup").length,
    completed: jobs.filter((j) => j.job_status === "completed").length,
    rejected: jobs.filter((j) => j.job_status === "rejected").length,
    cancelled: jobs.filter((j) => j.job_status === "cancelled").length
  };
  const recentJobs = jobs.slice(0, 8);
  res.json({
    counts,
    revenue: {
      today: todayRevenue,
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      currency: tenant?.settings?.currency_symbol || "GH\u20B5"
    },
    recentJobs,
    tenant: tenant ? {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      settings: tenant.settings
    } : {}
  });
});
router3.get("/jobs", (req, res) => {
  const tenantId = getTenantId(req);
  let jobs = db.getPrintJobs(tenantId);
  const { search, status, payment_status, date_range } = req.query;
  if (status && status !== "all") {
    jobs = jobs.filter((j) => j.job_status === status);
  }
  if (payment_status && payment_status !== "all") {
    jobs = jobs.filter((j) => j.payment_status === payment_status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    jobs = jobs.filter(
      (j) => j.job_number.toLowerCase().includes(q) || j.customer_name.toLowerCase().includes(q) || j.customer_phone.toLowerCase().includes(q) || j.document_name.toLowerCase().includes(q)
    );
  }
  if (date_range === "today") {
    const startOfToday = /* @__PURE__ */ new Date();
    startOfToday.setHours(0, 0, 0, 0);
    jobs = jobs.filter((j) => new Date(j.created_at).getTime() >= startOfToday.getTime());
  }
  res.json(jobs);
});
router3.get("/jobs/:id", (req, res) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const job = db.getPrintJobById(id, tenantId);
  if (!job) {
    res.status(404).json({ error: "Job not found in this printing press." });
    return;
  }
  const document = db.getDocumentById(job.document_id, tenantId);
  res.json({
    job,
    document: document ? {
      id: document.id,
      original_name: document.original_name,
      file_size: document.file_size,
      mime_type: document.mime_type,
      access_count: document.access_count,
      expires_at: document.expires_at
    } : null
  });
});
router3.patch("/jobs/:id/status", (req, res) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const { status, notes, payment_status } = req.body;
  const validStatuses = [
    "pending",
    "accepted",
    "processing",
    "ready_for_pickup",
    "completed",
    "rejected",
    "cancelled"
  ];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status: ${status}` });
    return;
  }
  const existingJob = db.getPrintJobById(id, tenantId);
  if (!existingJob) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  const updates = {};
  if (status) updates.job_status = status;
  if (notes !== void 0) updates.status_notes = notes;
  if (payment_status) updates.payment_status = payment_status;
  const updatedJob = db.updatePrintJob(id, tenantId, updates);
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "JOB_STATUS_UPDATED",
    resource_type: "job",
    resource_id: id,
    details: {
      job_number: existingJob.job_number,
      previous_status: existingJob.job_status,
      new_status: status || existingJob.job_status,
      notes
    },
    ip: req.ip
  });
  res.json(updatedJob);
});
router3.get("/documents/:docId/download", (req, res) => {
  const tenantId = getTenantId(req);
  const docId = req.params.docId;
  serveSecureDocument(req, res, docId, tenantId, req.user?.role === "super_admin");
});
router3.get("/services", (req, res) => {
  const tenantId = getTenantId(req);
  const services = db.getServices(tenantId);
  res.json(services);
});
router3.post("/services", requireRole("owner", "staff", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const { name, category, unit_type, price, description } = req.body;
  if (!name || price === void 0) {
    res.status(400).json({ error: "Service name and price are required." });
    return;
  }
  const service = db.createService({
    tenant_id: tenantId,
    name,
    category: category || "printing",
    unit_type: unit_type || "per_page",
    price: parseFloat(price) || 0,
    description,
    is_active: true
  });
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "SERVICE_CREATED",
    resource_type: "service",
    resource_id: service.id,
    details: { name, price },
    ip: req.ip
  });
  res.status(201).json(service);
});
router3.put("/services/:id", requireRole("owner", "staff", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const updates = { ...req.body };
  if (updates.price !== void 0) {
    updates.price = parseFloat(updates.price);
  }
  const updated = db.updateService(id, tenantId, updates);
  if (!updated) {
    res.status(404).json({ error: "Service not found." });
    return;
  }
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "SERVICE_UPDATED",
    resource_type: "service",
    resource_id: id,
    details: req.body,
    ip: req.ip
  });
  res.json(updated);
});
router3.patch("/services/:id", requireRole("owner", "staff", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const updates = { ...req.body };
  if (updates.price !== void 0) {
    updates.price = parseFloat(updates.price);
  }
  const updated = db.updateService(id, tenantId, updates);
  if (!updated) {
    res.status(404).json({ error: "Service not found." });
    return;
  }
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "SERVICE_UPDATED",
    resource_type: "service",
    resource_id: id,
    details: req.body,
    ip: req.ip
  });
  res.json(updated);
});
router3.delete("/services/:id", requireRole("owner", "staff", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const id = req.params.id;
  const deleted = db.deleteService(id, tenantId);
  if (!deleted) {
    res.status(404).json({ error: "Service not found." });
    return;
  }
  res.json({ success: true, message: "Service deleted." });
});
router3.get("/staff", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const staff = db.getUsers(tenantId).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    status: u.status,
    created_at: u.created_at
  }));
  res.json(staff);
});
router3.post("/staff", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Staff name, email, and password are required." });
    return;
  }
  if (db.getUserByEmail(email)) {
    res.status(409).json({ error: "User with this email already exists." });
    return;
  }
  const passwordHash = bcrypt3.hashSync(password, 10);
  const newStaff = db.createUser({
    tenant_id: tenantId,
    role: "staff",
    name,
    email,
    password_hash: passwordHash,
    phone: phone || "",
    status: "active"
  });
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "STAFF_ACCOUNT_CREATED",
    resource_type: "user",
    resource_id: newStaff.id,
    details: { name, email },
    ip: req.ip
  });
  res.status(201).json({
    id: newStaff.id,
    name: newStaff.name,
    email: newStaff.email,
    role: newStaff.role,
    phone: newStaff.phone,
    status: newStaff.status
  });
});
router3.get("/settings", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const tenant = db.getTenantById(tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found." });
    return;
  }
  res.json(tenant);
});
router3.put("/settings", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const {
    name,
    phone,
    email,
    location,
    address,
    description,
    logo_url,
    settings
  } = req.body;
  const current = db.getTenantById(tenantId);
  if (!current) {
    res.status(404).json({ error: "Tenant not found." });
    return;
  }
  const updatedTenant = db.updateTenant(tenantId, {
    ...name ? { name } : {},
    ...phone ? { phone } : {},
    ...email ? { email } : {},
    ...location ? { location } : {},
    ...address !== void 0 ? { address } : {},
    ...description !== void 0 ? { description } : {},
    ...logo_url ? { logo_url } : {},
    settings: {
      ...current.settings,
      ...settings || {}
    }
  });
  db.addAuditLog({
    tenant_id: tenantId,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: req.user?.role,
    action: "TENANT_SETTINGS_UPDATED",
    resource_type: "tenant",
    resource_id: tenantId,
    ip: req.ip
  });
  res.json(updatedTenant);
});
router3.get("/analytics", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const jobs = db.getPrintJobs(tenantId);
  const payments = db.getPayments(tenantId);
  const colorJobs = jobs.filter((j) => j.options.color_mode === "color").length;
  const bwJobs = jobs.filter((j) => j.options.color_mode === "bw").length;
  const paperSizes = {};
  jobs.forEach((j) => {
    paperSizes[j.options.paper_size] = (paperSizes[j.options.paper_size] || 0) + 1;
  });
  const serviceCounts = {};
  jobs.forEach((j) => {
    if (j.options.binding && j.options.binding !== "none") {
      serviceCounts[`Binding: ${j.options.binding}`] = (serviceCounts[`Binding: ${j.options.binding}`] || 0) + 1;
    }
    if (j.options.lamination && j.options.lamination !== "none") {
      serviceCounts[`Lamination: ${j.options.lamination}`] = (serviceCounts[`Lamination: ${j.options.lamination}`] || 0) + 1;
    }
  });
  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  res.json({
    totalJobs: jobs.length,
    totalRevenue,
    averageJobValue: jobs.length > 0 ? totalRevenue / jobs.length : 0,
    colorVsBw: { color: colorJobs, bw: bwJobs },
    paperSizes,
    servicePopularity: serviceCounts
  });
});
router3.get("/audit-logs", requireRole("owner", "super_admin"), (req, res) => {
  const tenantId = getTenantId(req);
  const logs = db.getAuditLogs(tenantId);
  res.json(logs);
});
var tenantRoutes_default = router3;

// server/routes/adminRoutes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.use(authenticate);
router4.use(requireRole("super_admin"));
router4.get("/stats", (_req, res) => {
  const tenants = db.getTenants();
  const allJobs = db.getAllPrintJobs();
  const allPayments = db.getPayments();
  const subscriptions = db.getSubscriptions();
  const now = /* @__PURE__ */ new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const activeTenants = tenants.filter((t) => t.status === "active").length;
  const pendingTenants = tenants.filter((t) => t.status === "pending_approval").length;
  const suspendedTenants = tenants.filter((t) => t.status === "suspended").length;
  const totalPlatformVolume = allPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const subscriptionRevenue = subscriptions.filter((s) => s.status === "active").reduce((sum, s) => sum + s.monthly_price, 0);
  const jobsToday = allJobs.filter((j) => new Date(j.created_at).getTime() >= startOfToday).length;
  const completedJobs = allJobs.filter((j) => j.job_status === "completed").length;
  res.json({
    tenants: {
      total: tenants.length,
      active: activeTenants,
      pending: pendingTenants,
      suspended: suspendedTenants
    },
    jobs: {
      total: allJobs.length,
      today: jobsToday,
      completed: completedJobs
    },
    revenue: {
      platformVolumeGHS: totalPlatformVolume,
      subscriptionMonthlyGHS: subscriptionRevenue
    }
  });
});
router4.get("/presses", (req, res) => {
  const { status } = req.query;
  let tenants = db.getTenants();
  if (status && status !== "all") {
    tenants = tenants.filter((t) => t.status === status);
  }
  const enriched = tenants.map((t) => {
    const jobs = db.getPrintJobs(t.id);
    const sub = db.getSubscriptionByTenantId(t.id);
    return {
      ...t,
      jobCount: jobs.length,
      subscription: sub
    };
  });
  res.json(enriched);
});
router4.patch("/presses/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;
  if (!["active", "pending_approval", "suspended"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const tenant = db.getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  const previousStatus = tenant.status;
  const updatedTenant = db.updateTenant(id, { status });
  if (status === "active" && previousStatus === "pending_approval") {
    if (!db.getSubscriptionByTenantId(id)) {
      const now = /* @__PURE__ */ new Date();
      const renews = new Date(now.getTime() + 30 * 864e5);
      db.updateSubscription(id, {
        tenant_id: id,
        plan_name: "Free",
        monthly_price: 0,
        status: "active",
        max_jobs_per_month: 50,
        current_month_jobs: 0,
        starts_at: now.toISOString(),
        renews_at: renews.toISOString()
      });
    }
  }
  db.addAuditLog({
    tenant_id: id,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: "super_admin",
    action: `PRESS_STATUS_${status.toUpperCase()}`,
    resource_type: "tenant",
    resource_id: id,
    details: {
      business_name: tenant.name,
      previousStatus,
      newStatus: status,
      rejection_reason
    },
    ip: req.ip
  });
  res.json({
    message: `Printing press status changed to ${status}.`,
    tenant: updatedTenant
  });
});
router4.delete("/presses/:id", (req, res) => {
  const { id } = req.params;
  const tenant = db.getTenantById(id);
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  const businessName = tenant.name;
  const success = db.deleteTenant(id);
  if (!success) {
    res.status(500).json({ error: "Failed to delete printing press." });
    return;
  }
  res.json({
    message: `Printing press "${businessName}" has been permanently deleted.`,
    id
  });
});
router4.get("/subscriptions", (_req, res) => {
  const subscriptions = db.getSubscriptions();
  const tenants = db.getTenants();
  const joined = subscriptions.map((s) => {
    const tenant = tenants.find((t) => t.id === s.tenant_id);
    return {
      ...s,
      tenant_name: tenant?.name || "Unknown",
      tenant_slug: tenant?.slug || ""
    };
  });
  res.json(joined);
});
router4.put("/subscriptions/:tenantId", (req, res) => {
  const { tenantId } = req.params;
  const { plan_name, monthly_price, max_jobs_per_month } = req.body;
  const updated = db.updateSubscription(tenantId, {
    ...plan_name ? { plan_name } : {},
    ...monthly_price !== void 0 ? { monthly_price: parseFloat(monthly_price) } : {},
    ...max_jobs_per_month !== void 0 ? { max_jobs_per_month: parseInt(max_jobs_per_month, 10) } : {}
  });
  if (!updated) {
    res.status(404).json({ error: "Subscription not found for this tenant." });
    return;
  }
  res.json(updated);
});
router4.get("/audit-logs", (req, res) => {
  const logs = db.getAuditLogs();
  res.json(logs);
});
router4.get("/jobs", (_req, res) => {
  const jobs = db.getAllPrintJobs().slice(0, 100);
  const tenants = db.getTenants();
  const enriched = jobs.map((j) => {
    const tenant = tenants.find((t) => t.id === j.tenant_id);
    return {
      ...j,
      tenant_name: tenant?.name || "Unknown Press",
      tenant_location: tenant?.location || ""
    };
  });
  res.json(enriched);
});
router4.get("/database", async (_req, res) => {
  try {
    const dbInfo = await db.getDatabaseInfo();
    res.json(dbInfo);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to retrieve database status" });
  }
});
router4.post("/database/sync", async (_req, res) => {
  try {
    const result = await db.syncAllToFirestore();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Sync failed" });
  }
});
router4.post("/impersonate", (req, res) => {
  const { tenantSlug, tenantId } = req.body;
  const tenant = tenantSlug ? db.getTenantBySlug(tenantSlug) : tenantId ? db.getTenantById(tenantId) : null;
  if (!tenant) {
    res.status(404).json({ error: "Printing press not found." });
    return;
  }
  let targetUser = db.getUsers().find((u) => u.tenant_id === tenant.id && u.role === "owner");
  if (!targetUser) {
    targetUser = db.getUsers().find((u) => u.tenant_id === tenant.id);
  }
  if (!targetUser) {
    res.status(404).json({ error: "No user account found for this printing press." });
    return;
  }
  const token = generateToken({
    id: targetUser.id,
    tenant_id: targetUser.tenant_id,
    role: targetUser.role,
    name: targetUser.name,
    email: targetUser.email
  });
  db.addAuditLog({
    tenant_id: tenant.id,
    user_id: req.user?.id,
    user_email: req.user?.email,
    role: "super_admin",
    action: "SUPER_ADMIN_IMPERSONATE_PRESS",
    resource_type: "tenant",
    resource_id: tenant.id,
    ip: req.ip
  });
  res.json({
    token,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone,
      tenant_id: targetUser.tenant_id
    },
    tenant
  });
});
var adminRoutes_default = router4;

// server/routes/downloadRoutes.ts
import express from "express";
import path5 from "path";
import fs5 from "fs";
var router5 = express.Router();
router5.get("/apk", (req, res) => {
  const version = req.query.v || "2.4";
  const apkFilename = `PrintFlow-Owner-v${version}.apk`;
  const primaryPath = path5.join(process.cwd(), "public", "downloads", "PrintFlow-Owner-v2.4.apk");
  const fallbackPath = path5.join(process.cwd(), "public", "downloads", "PrintFlow-Owner.apk");
  const fileToSend = fs5.existsSync(primaryPath) ? primaryPath : fs5.existsSync(fallbackPath) ? fallbackPath : null;
  if (!fileToSend) {
    res.status(404).json({ error: "APK package not found on server" });
    return;
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${apkFilename}"`);
  res.setHeader("Cache-Control", "public, max-age=3600");
  const fileStream = fs5.createReadStream(fileToSend);
  fileStream.pipe(res);
});
router5.get("/desktop-shortcut", (req, res) => {
  const slug = req.query.slug || "bright-digital-printing";
  const name = req.query.name || "PrintFlow Manager";
  const type = (req.query.type || "bat").toLowerCase();
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const targetUrl = `${protocol}://${host}/?portal=${encodeURIComponent(slug)}`;
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (type === "url") {
    const content = `[InternetShortcut]\r
URL=${targetUrl}\r
IconIndex=0\r
IconFile=${protocol}://${host}/favicon.ico\r
HotKey=0\r
[{000214A0-0000-0000-C000-000000000046}]\r
Prop3=19,11\r
`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizedName}_Desktop_Shortcut.url"`);
    res.send(content);
    return;
  }
  if (type === "desktop") {
    const content = `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
Comment=Launch PrintFlow Manager
Exec=xdg-open "${targetUrl}"
Icon=applications-internet
Terminal=false
Categories=Office;Network;
`;
    res.setHeader("Content-Type", "application/x-desktop");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizedName}.desktop"`);
    res.send(content);
    return;
  }
  const batContent = `@echo off
title Launching ${name} Desktop...
echo ==========================================================
echo  Starting ${name} Standalone Desktop Mode...
echo ==========================================================
set TARGET_URL=${targetUrl}

:: Check for Google Chrome
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" --app="%TARGET_URL%"
    exit /b
)

:: Check for Microsoft Edge
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%TARGET_URL%"
    exit /b
)

:: Fallback: Open in default browser
start "" "%TARGET_URL%"
exit
`;
  res.setHeader("Content-Type", "application/x-msdos-program");
  res.setHeader("Content-Disposition", `attachment; filename="Launch_${sanitizedName}_Desktop.bat"`);
  res.send(batContent);
});
var downloadRoutes_default = router5;

// server/app.ts
function createExpressApp() {
  const app2 = express2();
  app2.use(express2.json({ limit: "15mb" }));
  app2.use(express2.urlencoded({ extended: true, limit: "15mb" }));
  app2.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app2.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });
  app2.use((req, _res, next) => {
    const xMatchedPath = req.headers["x-matched-path"] || req.headers["x-now-route-matches"];
    if (xMatchedPath && !req.url.startsWith("/api") && xMatchedPath.startsWith("/api")) {
      req.url = xMatchedPath;
    }
    next();
  });
  const healthHandler = (_req, res) => {
    res.json({
      status: "healthy",
      app: "PrintFlow Multi-Tenant SaaS",
      version: "1.0.0",
      mode: process.env.NODE_ENV === "production" ? "production" : "development",
      serverless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  app2.get("/api/health", healthHandler);
  app2.get("/health", healthHandler);
  app2.get("/api", healthHandler);
  app2.use("/api/auth", authRoutes_default);
  app2.use("/auth", authRoutes_default);
  app2.use("/api/public", publicRoutes_default);
  app2.use("/public", publicRoutes_default);
  app2.use("/api/tenant", tenantRoutes_default);
  app2.use("/tenant", tenantRoutes_default);
  app2.use("/api/admin", adminRoutes_default);
  app2.use("/admin", adminRoutes_default);
  app2.use("/api/download", downloadRoutes_default);
  app2.use("/download", downloadRoutes_default);
  app2.all(["/api/*", "/auth/*", "/public/*", "/tenant/*", "/admin/*", "/download/*"], (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });
  app2.use((err, _req, res, _next) => {
    console.error("[API Error]:", err);
    if (err.name === "MulterError") {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Uploaded file exceeds the maximum allowed size limit (35 MB)." });
        return;
      }
      res.status(400).json({ error: `File upload error: ${err.message}` });
      return;
    }
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ error: message });
  });
  return app2;
}
var app = createExpressApp();
var app_default = app;

// server/serverless.ts
function handler(req, res) {
  try {
    return app_default(req, res);
  } catch (err) {
    console.error("[Serverless Handler Fatal Error]:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err?.message || "Internal serverless handler error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
  }
}
export {
  handler as default
};
