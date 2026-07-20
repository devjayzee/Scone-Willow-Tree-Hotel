/**
 * Report Service Module
 *
 * Organized by concern:
 * - report-dashboard: Dashboard overview (getDashboardStats)
 * - report-analytics: Detailed analytics (occupancy, revenue, trends, per-room performance)
 */

export { getDashboardStats } from "./report-dashboard";
export {
  getOccupancyReport,
  getRevenueReport,
  getBookingTrends,
  getRoomPerformance,
} from "./report-analytics";
