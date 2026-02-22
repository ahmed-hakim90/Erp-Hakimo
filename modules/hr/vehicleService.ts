import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { vehiclesRef } from './collections';
import { db } from '@/services/firebase';
import { HR_COLLECTIONS } from './collections';
import type { FirestoreVehicle } from './types';

const isConfigured = !!db;

export const vehicleService = {
  async getAll(): Promise<FirestoreVehicle[]> {
    if (!isConfigured) return [];
    try {
      const q = query(vehiclesRef(), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreVehicle));
    } catch {
      const snap = await getDocs(vehiclesRef());
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreVehicle));
      results.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      return results;
    }
  },

  async getById(id: string): Promise<FirestoreVehicle | null> {
    if (!isConfigured) return null;
    const snap = await getDoc(doc(db, HR_COLLECTIONS.VEHICLES, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as FirestoreVehicle;
  },

  async create(data: Omit<FirestoreVehicle, 'id'>): Promise<string> {
    const ref = await addDoc(vehiclesRef(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<FirestoreVehicle>): Promise<void> {
    const ref = doc(db, HR_COLLECTIONS.VEHICLES, id);
    await updateDoc(ref, data as any);
  },

  async delete(id: string): Promise<void> {
    const ref = doc(db, HR_COLLECTIONS.VEHICLES, id);
    await deleteDoc(ref);
  },
};
