/**
 * Daily Rate Salary Strategy
 *
 * For employees paid per working day.
 * Base = dailyRate * presentDays
 * No absence deduction (they only earn for days worked)
 * Overtime = (dailyRate / 8) * overtimeHours * multiplier
 */
import type { SalaryStrategy } from './types';
import type { PayrollEmployeeData } from '../types';

export const dailyStrategy: SalaryStrategy = {
  calculateBase(
    employee: PayrollEmployeeData,
    _workingDays: number,
    presentDays: number,
  ): number {
    const rate = employee.dailyRate ?? employee.baseSalary / 30;
    return Math.round(rate * presentDays * 100) / 100;
  },

  calculateAbsenceDeduction(
    _employee: PayrollEmployeeData,
    _absentDays: number,
    _workingDays: number,
  ): number {
    // Daily workers earn only for present days; no separate deduction
    return 0;
  },

  calculateOvertime(
    employee: PayrollEmployeeData,
    overtimeHours: number,
    multiplier: number,
  ): number {
    if (overtimeHours <= 0) return 0;
    const dailyRate = employee.dailyRate ?? employee.baseSalary / 30;
    const hourlyRate = dailyRate / 8;
    return Math.round(hourlyRate * overtimeHours * multiplier * 100) / 100;
  },
};
