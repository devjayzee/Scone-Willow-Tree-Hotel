import { Skeleton } from "@/components/ui/skeleton";

interface RoomTableSkeletonProps {
  rows?: number;
}

export function RoomTableSkeleton({ rows = 5 }: RoomTableSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden animate-pulse">
      {/* Mobile Card View Skeleton */}
      <div className="md:hidden divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            {/* Details */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            {/* Description */}
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      {/* Desktop Table View Skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Room</th>
              <th className="text-left px-6 py-3">Capacity</th>
              <th className="text-left px-6 py-3">Price</th>
              <th className="text-left px-6 py-3">Description</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-8" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-48" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-8 w-8" />
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
