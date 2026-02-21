/**
 * Unified Approval Engine
 *
 * Supports multi-level approval hierarchy for overtime, leave, and loan requests.
 * Auto-generates approval chains based on employee's managerId and job_position.level.
 * Enforces sequential approval — cannot skip levels.
 */
import {
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { departmentsRef, jobPositionsRef } from './collections';
import type {
  ApprovalChainItem,
  ApprovalRequestType,
  ApprovalStatus,
  JobLevel,
  FirestoreJobPosition,
  FirestoreDepartment,
} from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmployeeHierarchyInfo {
  employeeId: string;
  managerId?: string;
  departmentId: string;
  jobPositionId: string;
  jobLevel: JobLevel;
}

export interface ApprovalChainResult {
  chain: ApprovalChainItem[];
  errors: string[];
}

export interface ApprovalActionResult {
  success: boolean;
  updatedChain: ApprovalChainItem[];
  finalStatus: ApprovalStatus;
  error?: string;
}

// ─── Internal: Resolve Manager Hierarchy ────────────────────────────────────

interface ManagerInfo {
  employeeId: string;
  level: JobLevel;
}

/**
 * Build the approval chain by walking up the management hierarchy.
 * Each level above the requester's level gets an approver slot.
 */
async function resolveManagerChain(
  employee: EmployeeHierarchyInfo,
  allEmployees: EmployeeHierarchyInfo[],
): Promise<ManagerInfo[]> {
  const managers: ManagerInfo[] = [];
  const visited = new Set<string>();
  let current = employee;

  while (current.managerId && !visited.has(current.managerId)) {
    visited.add(current.managerId);
    const manager = allEmployees.find((e) => e.employeeId === current.managerId);
    if (!manager) break;

    if (manager.jobLevel > current.jobLevel || manager.jobLevel > employee.jobLevel) {
      managers.push({
        employeeId: manager.employeeId,
        level: manager.jobLevel,
      });
    }
    current = manager;
  }

  managers.sort((a, b) => a.level - b.level);
  return managers;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate an approval chain for a given request type.
 * Walks up the employee's manager hierarchy and creates a pending approval
 * at each level above the requester.
 */
export async function generateApprovalChain(
  employee: EmployeeHierarchyInfo,
  allEmployees: EmployeeHierarchyInfo[],
  _requestType: ApprovalRequestType,
): Promise<ApprovalChainResult> {
  const errors: string[] = [];

  if (!employee.managerId) {
    return {
      chain: [],
      errors: ['الموظف ليس لديه مدير مباشر — لا يمكن إنشاء سلسلة موافقات'],
    };
  }

  const managers = await resolveManagerChain(employee, allEmployees);

  if (managers.length === 0) {
    errors.push('لم يتم العثور على مديرين في التسلسل الوظيفي');
    return { chain: [], errors };
  }

  const chain: ApprovalChainItem[] = managers.map((m) => ({
    approverEmployeeId: m.employeeId,
    level: m.level,
    status: 'pending' as ApprovalStatus,
    actionDate: null,
    notes: '',
  }));

  return { chain, errors };
}

/**
 * Process an approval or rejection action on a chain.
 * Enforces sequential ordering: a level N approver cannot act
 * until all levels < N have approved.
 */
export function processApprovalAction(
  chain: ApprovalChainItem[],
  approverEmployeeId: string,
  action: 'approved' | 'rejected',
  notes: string = '',
): ApprovalActionResult {
  const idx = chain.findIndex((item) => item.approverEmployeeId === approverEmployeeId);

  if (idx === -1) {
    return {
      success: false,
      updatedChain: chain,
      finalStatus: 'pending',
      error: 'المُعتمد غير موجود في سلسلة الموافقات',
    };
  }

  const item = chain[idx];

  if (item.status !== 'pending') {
    return {
      success: false,
      updatedChain: chain,
      finalStatus: deriveFinalStatus(chain),
      error: 'تم اتخاذ إجراء مسبق على هذا المستوى',
    };
  }

  const previousPending = chain.slice(0, idx).some((prev) => prev.status === 'pending');
  if (previousPending) {
    return {
      success: false,
      updatedChain: chain,
      finalStatus: 'pending',
      error: 'لا يمكن تخطي مستويات الموافقة — يجب الموافقة من المستوى الأدنى أولاً',
    };
  }

  const previousRejected = chain.slice(0, idx).some((prev) => prev.status === 'rejected');
  if (previousRejected) {
    return {
      success: false,
      updatedChain: chain,
      finalStatus: 'rejected',
      error: 'تم رفض الطلب في مستوى سابق',
    };
  }

  const updatedChain = chain.map((c, i) => {
    if (i !== idx) return c;
    return {
      ...c,
      status: action,
      actionDate: new Date(),
      notes,
    };
  });

  const finalStatus = deriveFinalStatus(updatedChain);

  return {
    success: true,
    updatedChain,
    finalStatus,
  };
}

/**
 * Derive the final status from a chain:
 * - If any item is rejected → rejected
 * - If all items are approved → approved
 * - Otherwise → pending
 */
export function deriveFinalStatus(chain: ApprovalChainItem[]): ApprovalStatus {
  if (chain.length === 0) return 'approved';
  if (chain.some((item) => item.status === 'rejected')) return 'rejected';
  if (chain.every((item) => item.status === 'approved')) return 'approved';
  return 'pending';
}

/**
 * Check whether a given approver can act on a chain right now.
 */
export function canApproverAct(
  chain: ApprovalChainItem[],
  approverEmployeeId: string,
): boolean {
  const idx = chain.findIndex((item) => item.approverEmployeeId === approverEmployeeId);
  if (idx === -1) return false;
  if (chain[idx].status !== 'pending') return false;
  return chain.slice(0, idx).every((prev) => prev.status === 'approved');
}

/**
 * Get all pending requests where a given employee is the next required approver.
 * Useful for building the Approval Center inbox.
 */
export function filterActionableForApprover<T extends { approvalChain: ApprovalChainItem[]; finalStatus: ApprovalStatus }>(
  requests: T[],
  approverEmployeeId: string,
): T[] {
  return requests.filter((req) => {
    if (req.finalStatus !== 'pending') return false;
    return canApproverAct(req.approvalChain, approverEmployeeId);
  });
}
