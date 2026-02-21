export type { SalaryStrategy } from './types';
export { monthlyStrategy } from './monthlyStrategy';
export { dailyStrategy } from './dailyStrategy';
export { hourlyStrategy } from './hourlyStrategy';

import type { EmploymentType } from '../types';
import type { SalaryStrategy } from './types';
import { monthlyStrategy } from './monthlyStrategy';
import { dailyStrategy } from './dailyStrategy';
import { hourlyStrategy } from './hourlyStrategy';

const STRATEGY_MAP: Record<EmploymentType, SalaryStrategy> = {
  monthly: monthlyStrategy,
  daily: dailyStrategy,
  hourly: hourlyStrategy,
};

/** Resolve the correct salary strategy for an employment type */
export function getStrategy(type: EmploymentType): SalaryStrategy {
  return STRATEGY_MAP[type];
}
