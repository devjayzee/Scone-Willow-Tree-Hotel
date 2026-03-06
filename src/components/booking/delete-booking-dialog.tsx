"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingRef: string;
  guestName: string;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export function DeleteBookingDialog({
  open,
  onOpenChange,
  bookingRef,
  guestName,
  onConfirm,
  isLoading,
}: DeleteBookingDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete booking <span className="font-medium text-gray-900">{bookingRef}</span> for <span className="font-medium text-gray-900">{guestName}</span>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
