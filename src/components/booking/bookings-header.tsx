"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface BookingsHeaderProps {
  onCreateClick: () => void;
}

export function BookingsHeader({ onCreateClick }: BookingsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Bookings</h1>
        <p className="text-muted-foreground">Manage guest reservations</p>
      </div>
      <Button
        onClick={onCreateClick}
        className="bg-navy hover:bg-navy-dark text-cream"
      >
        <Plus className="h-4 w-4 mr-2" />
        New Booking
      </Button>
    </div>
  );
}
