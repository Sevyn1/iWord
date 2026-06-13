export default function SermonDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="h-3 w-40 shimmer rounded mb-6" />
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
        <div className="aspect-[16/9] w-full shimmer rounded-2xl" />
        <div>
          <div className="h-10 w-4/5 shimmer rounded mb-3" />
          <div className="h-10 w-3/5 shimmer rounded mb-6" />
          <div className="h-14 w-full shimmer rounded-full mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 shimmer rounded-lg" />
            ))}
          </div>
          <div className="mt-6 h-36 shimmer rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
