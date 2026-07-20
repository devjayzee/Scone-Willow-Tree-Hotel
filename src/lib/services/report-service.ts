/**
 * Report Service
 *
 * This file re-exports from the modular report service for backwards compatibility.
 * For new code, consider importing directly from '@/lib/services/report'.
 *
 * @module report-service
 * @see {@link ./report/index.ts} for the modular implementation
 */

export {
  getDashboardStats,
  getOccupancyReport,
  getRevenueReport,
  getBookingTrends,
  getRoomPerformance,
} from "./report";
