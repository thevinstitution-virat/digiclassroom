export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
        <div className="h-4 bg-muted rounded w-5/6"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted rounded-lg h-32"></div>
        ))}
      </div>
    </div>
  )
} 