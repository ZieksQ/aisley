export default function ShopLoading() {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-4 sm:px-5 lg:px-8" aria-busy="true" aria-label="Loading shop">
      <div className="overflow-hidden rounded-lg border border-[#E2DCE4] bg-white">
        <div className="aspect-[4/1] min-h-28 animate-pulse bg-[#EEE9EF]" />
        <div className="space-y-3 p-5">
          <div className="h-8 w-1/3 animate-pulse rounded bg-[#EAE4EC]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#F0ECF1]" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-[#EEE9EF]" />
        ))}
      </div>
    </main>
  );
}
