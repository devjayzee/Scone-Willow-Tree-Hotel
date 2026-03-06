export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 w-64 bg-gray-200 rounded"></div>
      </div>

      {/* Card Skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="h-6 w-40 bg-gray-200 rounded"></div>
          <div className="h-9 w-28 bg-gray-200 rounded"></div>
        </div>

        {/* Table Skeleton */}
        <div className="p-6">
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
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-3 px-4">
                    <div className="h-4 w-20 bg-gray-200 rounded"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-12 bg-gray-200 rounded ml-auto"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-8 bg-gray-200 rounded ml-auto"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-8 bg-gray-200 rounded ml-auto"></div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-4 w-16 bg-gray-200 rounded ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50">
                <td colSpan={2} className="py-3 px-4">
                  <div className="h-4 w-12 bg-gray-300 rounded"></div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="h-4 w-8 bg-gray-300 rounded ml-auto"></div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="h-4 w-8 bg-gray-300 rounded ml-auto"></div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="h-4 w-20 bg-gray-300 rounded ml-auto"></div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
