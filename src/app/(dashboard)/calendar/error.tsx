"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CalendarError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Calendar page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">
          Failed to load calendar
        </h2>
        <p className="text-muted-foreground max-w-md">
          Something went wrong while loading the calendar. Please try again.
        </p>
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Try Again
      </Button>
    </div>
  );
}
