import { Skeleton } from "@/components/ui/skeleton";

interface ReportTableSkeletonProps {
  rows?: number;
}

export function ReportTableSkeleton({ rows = 8 }: ReportTableSkeletonProps) {
  return (
    <div className="animate-pulse">
      {/* Mobile Card Skeleton */}
      <div className="md:hidden divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded-lg py-2 flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="bg-gray-50 rounded-lg py-2 flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="bg-gray-50 rounded-lg py-2 flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Skeleton */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-sm font-medium text-gray-500">
              <th className="text-left py-3 px-4">Room</th>
              <th className="text-right py-3 px-4">Rate/Night</th>
              <th className="text-right py-3 px-4">Total Bookings</th>
              <th className="text-right py-3 px-4">Total Nights</th>
              <th className="text-right py-3 px-4">Total Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-12 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-8 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-16 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={2} className="py-3 px-4">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="py-3 px-4">
                <Skeleton className="h-4 w-8 ml-auto" />
              </td>
              <td className="py-3 px-4">
                <Skeleton className="h-4 w-8 ml-auto" />
              </td>
              <td className="py-3 px-4">
                <Skeleton className="h-4 w-16 ml-auto" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
