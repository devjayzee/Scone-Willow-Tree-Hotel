/**
 * Room performance data for analytics.
 * `bookedRevenue` counts CONFIRMED + CHECKED_IN + CHECKED_OUT — includes
 * money on the books for future confirmed stays.
 */
export interface RoomPerformanceData {
  id: string;
  roomNumber: string;
  pricePerNight: number;
  totalBookings: number;
  totalNights: number;
  bookedRevenue: number;
}
