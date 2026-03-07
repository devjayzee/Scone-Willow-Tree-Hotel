import { Skeleton } from "@/components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Mobile Skeleton */}
      <div className="md:hidden space-y-4">
        {/* Calendar Grid */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b py-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[56px] p-1 border-b border-r border-gray-100 flex flex-col items-center pt-2"
              >
                <Skeleton className="h-5 w-5 rounded-full" />
                {i % 4 === 0 && (
                  <div className="flex gap-0.5 mt-1">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Date Card */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <Skeleton className="h-5 w-48 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-5" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden md:block" style={{ minHeight: "700px" }}>
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4 px-2">
          <Skeleton className="h-6 w-24" />
          <div className="flex gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Skeleton key={day} className="h-4 w-12" />
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-white p-2 min-h-[100px]">
              <Skeleton className="h-5 w-5 mb-2" />
              {i % 4 === 0 && <Skeleton className="h-5 w-full mb-1 rounded" />}
              {i % 6 === 0 && <Skeleton className="h-5 w-3/4 mb-1 rounded" />}
              {i % 8 === 0 && <Skeleton className="h-5 w-5/6 rounded" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
