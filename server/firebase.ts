import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  Firestore,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;
let isFirestoreInitialized = false;
let lastHealthCheckStatus = {
  connected: false,
  databaseId: '',
  projectId: '',
  lastChecked: '',
  error: null as string | null,
};

function getFirebaseConfig() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Firebase Server] Failed to read firebase-applet-config.json:', err);
  }
  return null;
}

export function initServerFirestore(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    const config = getFirebaseConfig();
    if (!config) {
      console.warn('[Firebase Server] No firebase-applet-config.json found.');
      return null;
    }

    const app = !getApps().length ? initializeApp(config) : getApp();
    const databaseId = config.firestoreDatabaseId || '(default)';
    firestoreInstance = getFirestore(app, databaseId);
    isFirestoreInitialized = true;
    lastHealthCheckStatus = {
      connected: true,
      databaseId,
      projectId: config.projectId,
      lastChecked: new Date().toISOString(),
      error: null,
    };
    console.log(`[Firebase Server] Connected to Firestore database: ${databaseId} (Project: ${config.projectId})`);
    return firestoreInstance;
  } catch (err: any) {
    console.error('[Firebase Server] Failed to initialize Firestore:', err);
    lastHealthCheckStatus = {
      connected: false,
      databaseId: '',
      projectId: '',
      lastChecked: new Date().toISOString(),
      error: err?.message || 'Unknown initialization error',
    };
    return null;
  }
}

export async function checkFirestoreHealth() {
  const db = initServerFirestore();
  if (!db) {
    return {
      connected: false,
      databaseId: '',
      projectId: '',
      error: lastHealthCheckStatus.error || 'Firestore not initialized',
      counts: {},
    };
  }

  try {
    // Quick probe on tenants collection
    const tenantsRef = collection(db, 'tenants');
    const snap = await getDocs(query(tenantsRef, limit(1)));
    lastHealthCheckStatus.connected = true;
    lastHealthCheckStatus.lastChecked = new Date().toISOString();
    lastHealthCheckStatus.error = null;

    return {
      connected: true,
      databaseId: lastHealthCheckStatus.databaseId,
      projectId: lastHealthCheckStatus.projectId,
      lastChecked: lastHealthCheckStatus.lastChecked,
      error: null,
    };
  } catch (err: any) {
    console.warn('[Firebase Server] Firestore health probe failed:', err?.message);
    lastHealthCheckStatus.connected = false;
    lastHealthCheckStatus.error = err?.message;
    return {
      connected: false,
      databaseId: lastHealthCheckStatus.databaseId,
      projectId: lastHealthCheckStatus.projectId,
      error: err?.message,
    };
  }
}

/**
 * Persist document into Firestore asynchronously (non-blocking for HTTP response)
 */
export async function syncDocToFirestore(collectionName: string, docId: string, data: any) {
  try {
    const db = initServerFirestore();
    if (!db) return false;
    const docRef = doc(db, collectionName, docId);
    // Sanitize any undefined properties for Firestore
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.error(`[Firebase Server] Error saving to ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Remove document from Firestore
 */
export async function deleteDocFromFirestore(collectionName: string, docId: string) {
  try {
    const db = initServerFirestore();
    if (!db) return false;
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`[Firebase Server] Error deleting from ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Fetch document from Firestore
 */
export async function fetchDocFromFirestore<T = any>(collectionName: string, docId: string): Promise<T | null> {
  try {
    const db = initServerFirestore();
    if (!db) return null;
    const docRef = doc(db, collectionName, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as T;
    }
  } catch (err) {
    console.error(`[Firebase Server] Error fetching ${collectionName}/${docId}:`, err);
  }
  return null;
}

/**
 * Fetch all documents in a collection from Firestore
 */
export async function fetchCollectionFromFirestore<T = any>(collectionName: string): Promise<T[]> {
  try {
    const db = initServerFirestore();
    if (!db) return [];
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as T);
  } catch (err) {
    console.error(`[Firebase Server] Error fetching collection ${collectionName}:`, err);
    return [];
  }
}

/**
 * Direct lookup of user by email in Firestore
 */
export async function findUserByEmailInFirestore(email: string): Promise<any | null> {
  try {
    const db = initServerFirestore();
    if (!db) return null;
    const usersRef = collection(db, 'users');
    const cleanEmail = email.toLowerCase().trim();
    const q = query(usersRef, where('email', '==', cleanEmail), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
  } catch (err) {
    console.error(`[Firebase Server] Error finding user by email ${email}:`, err);
  }
  return null;
}
