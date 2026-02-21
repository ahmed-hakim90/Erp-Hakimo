/**
 * Payroll Integration — Functions consumed by the Payroll Engine.
 *
 * These bridge the Leave and Loan modules into payroll processing.
 * Pure data retrieval — the Payroll Engine decides how to apply them.
 */
import { leaveRequestService } from './leaveService';
import { loanService } from './loanService';
import type {
  FirestoreLeaveRequest,
  LoanInstallment,
} from './types';

/**
 * Get all approved leaves for an employee within a payroll month.
 *
 * @param employeeId  The employee to query
 * @param month       The payroll month in "YYYY-MM" format
 * @returns           Array of approved leave requests overlapping the month
 */
export async function getApprovedLeaves(
  employeeId: string,
  month: string,
): Promise<FirestoreLeaveRequest[]> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  return leaveRequestService.getApprovedByEmployeeAndRange(
    employeeId,
    startDate,
    endDate,
  );
}

/**
 * Get active loan installments for an employee (for monthly deduction).
 *
 * @param employeeId  The employee to query
 * @param _month      The payroll month (reserved for future per-month logic)
 * @returns           Array of installment records to deduct
 */
export async function getActiveLoanInstallments(
  employeeId: string,
  _month: string,
): Promise<LoanInstallment[]> {
  return loanService.getActiveInstallments(employeeId);
}
