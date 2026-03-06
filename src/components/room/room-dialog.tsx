"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Room {
  id: string;
  roomNumber: string;
  capacity: number;
  pricePerNight: string | number;
  description: string | null;
}

interface RoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  onSubmit: (data: {
    roomNumber: string;
    capacity: number;
    pricePerNight: number;
    description?: string;
  }) => Promise<void>;
}

export function RoomDialog({ open, onOpenChange, room, onSubmit }: RoomDialogProps) {
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [pricePerNight, setPricePerNight] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!room;

  useEffect(() => {
    if (room) {
      setRoomNumber(room.roomNumber);
      setCapacity(room.capacity.toString());
      setPricePerNight(
        typeof room.pricePerNight === "string"
          ? room.pricePerNight
          : room.pricePerNight.toString()
      );
      setDescription(room.description || "");
    } else {
      setRoomNumber("");
      setCapacity("1");
      setPricePerNight("");
      setDescription("");
    }
    setError("");
  }, [room, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await onSubmit({
        roomNumber,
        capacity: parseInt(capacity) || 1,
        pricePerNight: parseFloat(pricePerNight) || 0,
        description: description || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-navy">
            {isEditing ? "Edit Room" : "Add New Room"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomNumber">Room Number</Label>
                <Input
                  id="roomNumber"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g., 1, 2, 3"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (Guests)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="10"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerNight">Price per Night ($)</Label>
                <Input
                  id="pricePerNight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerNight}
                  onChange={(e) => setPricePerNight(e.target.value)}
                  placeholder="e.g., 99.00"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Room features and amenities..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-navy hover:bg-navy-dark text-cream"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
