import type { BookingStatus } from "@prisma/client";

/**
 * Room performance data for analytics
 */
export interface RoomPerformanceData {
  id: string;
  roomNumber: string;
  pricePerNight: number;
  totalBookings: number;
  totalNights: number;
  totalRevenue: number;
}

/**
 * Recent booking summary for dashboard display
 */
export interface RecentBooking {
  id: string;
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  checkIn: string | Date;
  checkOut: string | Date;
  status: BookingStatus;
  createdAt: string | Date;
  room: {
    roomNumber: string;
  };
}

/**
 * Dashboard statistics overview
 */
export interface DashboardStats {
  todayCheckIns: number;
  todayCheckOuts: number;
  currentOccupancy: number;
  occupancyRate: number;
  pendingBookings: number;
  totalRooms: number;
  recentBookings: RecentBooking[];
}

/**
 * Monthly occupancy data for trend analysis
 */
export interface OccupancyData {
  month: string;
  occupancy: number;
  bookedDays: number;
  totalDays: number;
}

/**
 * Monthly revenue data for trend analysis
 */
export interface RevenueData {
  month: string;
  revenue: number;
}

/**
 * Daily booking trend data
 */
export interface BookingTrendData {
  date: string;
  bookings: number;
}

/**
 * Report type enum for API requests
 */
export type ReportType = "dashboard" | "occupancy" | "revenue" | "bookings" | "rooms";

/**
 * Date range filter for reports
 */
export interface ReportDateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Report query parameters
 */
export interface ReportQueryParams {
  type: ReportType;
  startDate?: string;
  endDate?: string;
}
