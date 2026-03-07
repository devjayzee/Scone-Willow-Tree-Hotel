export default function CalendarLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-28 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-56 bg-gray-200 rounded"></div>
      </div>

      {/* Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded"></div>
          <div className="h-10 w-16 bg-gray-200 rounded"></div>
          <div className="h-10 w-10 bg-gray-200 rounded"></div>
          <div className="h-6 w-32 bg-gray-200 rounded ml-2"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-[180px] bg-gray-200 rounded"></div>
          <div className="h-10 w-[180px] bg-gray-200 rounded"></div>
          <div className="h-10 w-10 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Legend Skeleton */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border">
        <div className="h-4 w-16 bg-gray-200 rounded"></div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Calendar Grid Skeleton */}
      <div className="bg-white rounded-lg border p-4" style={{ height: "600px" }}>
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center"
            >
              <div className="h-4 w-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="h-20 border border-gray-100 rounded p-1"
            >
              <div className="h-4 w-6 bg-gray-200 rounded mb-1"></div>
              {i % 5 === 0 && (
                <div className="h-5 w-full bg-gray-200 rounded"></div>
              )}
              {i % 7 === 3 && (
                <div className="h-5 w-full bg-gray-200 rounded mt-1"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
