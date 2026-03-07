import { Skeleton } from "@/components/ui/skeleton";

interface StaffTableSkeletonProps {
  rows?: number;
}

export function StaffTableSkeleton({ rows = 5 }: StaffTableSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden animate-pulse">
      {/* Mobile Card View Skeleton */}
      <div className="md:hidden divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 space-y-3">
            {/* Header with avatar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
            {/* Details */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View Skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50/50 text-sm font-medium text-gray-500">
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-center px-6 py-3">Role</th>
              <th className="text-center px-6 py-3">Status</th>
              <th className="text-center px-6 py-3">Bookings</th>
              <th className="text-center px-6 py-3">Created</th>
              <th className="text-center px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-40" />
                </td>
                <td className="px-6 py-4 text-center">
                  <Skeleton className="h-6 w-16 rounded-full mx-auto" />
                </td>
                <td className="px-6 py-4 text-center">
                  <Skeleton className="h-6 w-14 rounded-full mx-auto" />
                </td>
                <td className="px-6 py-4 text-center">
                  <Skeleton className="h-4 w-8 mx-auto" />
                </td>
                <td className="px-6 py-4 text-center">
                  <Skeleton className="h-4 w-24 mx-auto" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <Skeleton className="h-8 w-8" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t bg-gray-50/30">
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}
