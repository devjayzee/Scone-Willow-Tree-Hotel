"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import {
  CalendarCheck,
  CalendarX,
  BedDouble,
  ClipboardList,
  Plus,
  LogIn,
  ArrowRight,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

type BookingStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

interface DashboardData {
  todayCheckIns: number;
  todayCheckOuts: number;
  currentOccupancy: number;
  occupancyRate: number;
  pendingBookings: number;
  totalRooms: number;
  recentBookings: {
    id: string;
    bookingRef: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    createdAt: string;
    room: {
      roomNumber: string;
    };
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reports?type=dashboard");
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = [
    {
      title: "Today's Check-ins",
      value: data?.todayCheckIns ?? 0,
      icon: CalendarCheck,
      description: "Guests arriving today",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Today's Check-outs",
      value: data?.todayCheckOuts ?? 0,
      icon: CalendarX,
      description: "Guests leaving today",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Current Occupancy",
      value: `${data?.occupancyRate ?? 0}%`,
      icon: BedDouble,
      description: `${data?.currentOccupancy ?? 0} of ${data?.totalRooms ?? 8} rooms occupied`,
      color: "text-gold",
      bgColor: "bg-amber-50",
    },
    {
      title: "Upcoming Bookings",
      value: data?.pendingBookings ?? 0,
      icon: ClipboardList,
      description: "Confirmed reservations",
      color: "text-navy",
      bgColor: "bg-slate-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your hotel&apos;s current status
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchDashboardData}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-navy">
                {isLoading ? "-" : stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Bookings */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/bookings">
              <Button className="w-full justify-start bg-navy hover:bg-navy-dark text-cream">
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </Link>
            <Link href="/bookings">
              <Button variant="outline" className="w-full justify-start">
                <LogIn className="h-4 w-4 mr-2" />
                Check-in Guest
              </Button>
            </Link>
            <Link href="/calendar">
              <Button variant="outline" className="w-full justify-start">
                <CalendarCheck className="h-4 w-4 mr-2" />
                View Calendar
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="bg-white lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-navy">Recent Bookings</CardTitle>
            <Link href="/bookings">
              <Button variant="ghost" size="sm" className="text-navy">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-navy" />
              </div>
            ) : data?.recentBookings && data.recentBookings.length > 0 ? (
              <div className="space-y-4">
                {data.recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-navy">
                          {booking.bookingRef}
                        </span>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {booking.guestName} · Room {booking.room.roomNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(booking.checkIn), "MMM dd")} -{" "}
                        {format(new Date(booking.checkOut), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <Link href="/bookings">
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent bookings</p>
                <Link href="/bookings">
                  <Button variant="link" className="mt-2">
                    Create your first booking
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
