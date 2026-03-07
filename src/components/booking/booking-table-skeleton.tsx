import { Skeleton } from "@/components/ui/skeleton";

interface BookingTableSkeletonProps {
  rows?: number;
}

export function BookingTableSkeleton({ rows = 5 }: BookingTableSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden animate-pulse">
      {/* Mobile Card View Skeleton */}
      <div className="md:hidden divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
            {/* Guest Info */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Room & Dates */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View Skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Booking Ref</th>
              <th className="text-left px-6 py-3">Guest</th>
              <th className="text-left px-6 py-3">Room</th>
              <th className="text-left px-6 py-3">Check In</th>
              <th className="text-left px-6 py-3">Check Out</th>
              <th className="text-center px-6 py-3">Status</th>
              <th className="text-center px-6 py-3">Paid</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-6 w-20 rounded-full mx-auto" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-6 w-14 rounded-full mx-auto" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <Skeleton className="h-8 w-8" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t bg-gray-50/30">
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
