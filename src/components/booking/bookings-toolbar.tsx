"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";

interface BookingsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isFetching: boolean;
}

export function BookingsToolbar({
  searchQuery,
  onSearchChange,
  onRefresh,
  isFetching,
}: BookingsToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search bookings..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isFetching}
        title="Refresh bookings"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
