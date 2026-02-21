/**
 * Loan Service — Firestore CRUD for employee loans and installment tracking.
 * Handles loan creation, approval activation, and installment deduction.
 */
import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isConfigured } from '@/services/firebase';
import {
  employeeLoansRef,
  HR_COLLECTIONS,
} from './collections';
import type {
  FirestoreEmployeeLoan,
  ApprovalChainItem,
  ApprovalStatus,
  LoanInstallment,
} from './types';

export const loanService = {
  async create(data: Omit<FirestoreEmployeeLoan, 'id' | 'createdAt'>): Promise<string> {
    if (!isConfigured) return '';
    const docRef = await addDoc(employeeLoansRef(), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getAll(): Promise<FirestoreEmployeeLoan[]> {
    if (!isConfigured) return [];
    const q = query(employeeLoansRef(), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreEmployeeLoan));
  },

  async getByEmployee(employeeId: string): Promise<FirestoreEmployeeLoan[]> {
    if (!isConfigured) return [];
    const q = query(
      employeeLoansRef(),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreEmployeeLoan));
  },

  async getById(id: string): Promise<FirestoreEmployeeLoan | null> {
    if (!isConfigured) return null;
    const snap = await getDoc(doc(db, HR_COLLECTIONS.EMPLOYEE_LOANS, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as FirestoreEmployeeLoan;
  },

  async getPending(): Promise<FirestoreEmployeeLoan[]> {
    if (!isConfigured) return [];
    const q = query(
      employeeLoansRef(),
      where('finalStatus', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreEmployeeLoan));
  },

  async getActive(): Promise<FirestoreEmployeeLoan[]> {
    if (!isConfigured) return [];
    const q = query(
      employeeLoansRef(),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreEmployeeLoan));
  },

  async updateApproval(
    id: string,
    approvalChain: ApprovalChainItem[],
    finalStatus: ApprovalStatus,
  ): Promise<void> {
    if (!isConfigured) return;
    const updates: Record<string, any> = { approvalChain, finalStatus };

    if (finalStatus === 'approved') {
      updates.status = 'active';
    } else if (finalStatus === 'rejected') {
      updates.status = 'pending';
    }

    await updateDoc(doc(db, HR_COLLECTIONS.EMPLOYEE_LOANS, id), updates);
  },

  /**
   * Process a monthly installment deduction for an active loan.
   * Decreases remainingInstallments and closes the loan when done.
   */
  async processInstallment(loanId: string): Promise<{ closed: boolean }> {
    if (!isConfigured) return { closed: false };

    const loan = await this.getById(loanId);
    if (!loan || loan.status !== 'active') return { closed: false };

    const newRemaining = Math.max(0, loan.remainingInstallments - 1);
    const closed = newRemaining === 0;

    await updateDoc(doc(db, HR_COLLECTIONS.EMPLOYEE_LOANS, loanId), {
      remainingInstallments: newRemaining,
      status: closed ? 'closed' : 'active',
    });

    return { closed };
  },

  /**
   * Get all active loan installments for a given employee (for payroll deduction).
   */
  async getActiveInstallments(employeeId: string): Promise<LoanInstallment[]> {
    if (!isConfigured) return [];
    const q = query(
      employeeLoansRef(),
      where('employeeId', '==', employeeId),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as FirestoreEmployeeLoan;
      return {
        loanId: d.id,
        employeeId: data.employeeId,
        installmentAmount: data.installmentAmount,
        remainingInstallments: data.remainingInstallments,
      };
    });
  },
};
