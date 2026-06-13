export default function HomeLoading() {
  return (
    <div>
      <div className="bg-grain border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_1fr] gap-12">
          <div>
            <div className="h-3 w-56 shimmer rounded-full mb-6" />
            <div className="h-12 w-3/4 shimmer rounded-lg mb-4" />
            <div className="h-12 w-2/3 shimmer rounded-lg mb-6" />
            <div className="h-4 w-full max-w-md shimmer rounded mb-2" />
            <div className="h-4 w-4/5 max-w-md shimmer rounded mb-8" />
            <div className="flex gap-3">
              <div className="h-12 w-40 shimmer rounded-full" />
              <div className="h-12 w-28 shimmer rounded-full" />
            </div>
          </div>
          <div className="aspect-[16/9] w-full shimmer rounded-2xl" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-16">
        <div className="h-7 w-48 shimmer rounded mb-6" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div>
      <div className="aspect-[16/9] w-full shimmer rounded-xl" />
      <div className="mt-3 flex gap-3">
        <div className="w-9 h-9 rounded-full shimmer shrink-0" />
        <div className="flex-1">
          <div className="h-4 w-4/5 shimmer rounded mb-2" />
          <div className="h-3 w-1/2 shimmer rounded" />
        </div>
      </div>
    </div>
  );
}
