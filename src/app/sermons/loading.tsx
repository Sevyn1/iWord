export default function SermonsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <div className="h-9 w-64 shimmer rounded mb-3" />
        <div className="h-4 w-40 shimmer rounded" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 shimmer rounded-full" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[16/9] w-full shimmer rounded-xl" />
            <div className="mt-3 flex gap-3">
              <div className="w-9 h-9 rounded-full shimmer shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-4/5 shimmer rounded mb-2" />
                <div className="h-3 w-1/2 shimmer rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
