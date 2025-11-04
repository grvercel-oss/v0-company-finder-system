export default function AnalyticsLoading() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="h-9 w-64 bg-muted animate-pulse rounded mb-2" />
        <div className="h-5 w-96 bg-muted animate-pulse rounded" />
      </div>

      {/* Platform Overview Skeleton */}
      <div>
        <div className="h-7 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-3">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Email Performance Skeleton */}
      <div>
        <div className="h-7 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-3">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Cost Overview Skeleton */}
      <div>
        <div className="h-7 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-3">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
