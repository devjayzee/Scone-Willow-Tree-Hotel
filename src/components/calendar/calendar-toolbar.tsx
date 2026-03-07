"use client";

import { memo } from "react";
import { View } from "react-big-calendar";
import { format, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { RoomSummary } from "@/types/room";

interface CalendarToolbarProps {
  date: Date;
  view: View;
  selectedRoom: string;
  rooms: RoomSummary[];
  isRefreshing: boolean;
  onNavigate: (date: Date) => void;
  onViewChange: (view: View) => void;
  onRoomChange: (roomId: string) => void;
  onRefresh: () => void;
}

export const CalendarToolbar = memo(function CalendarToolbar({
  date,
  view,
  selectedRoom,
  rooms,
  isRefreshing,
  onNavigate,
  onViewChange,
  onRoomChange,
  onRefresh,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 p-4 bg-white rounded-lg border">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate(addMonths(date, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => onNavigate(new Date())}>
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate(addMonths(date, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-navy ml-2">
          {format(date, "MMMM yyyy")}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedRoom} onValueChange={onRoomChange}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Filter by room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                Room {room.roomNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex border rounded-md">
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("month")}
            className="rounded-r-none"
          >
            Month
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("week")}
            className="rounded-none border-x"
          >
            Week
          </Button>
          <Button
            variant={view === "agenda" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewChange("agenda")}
            className="rounded-l-none"
          >
            Agenda
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>
    </div>
  );
});
