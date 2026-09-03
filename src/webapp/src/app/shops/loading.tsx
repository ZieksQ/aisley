export default function ShopsLoading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-7 sm:px-5 lg:px-8 lg:py-10" aria-busy="true" aria-label="Loading shops">
      <div className="mb-6 h-9 w-48 animate-pulse rounded-md bg-[#EAE4EC]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-[#E2DCE4] bg-white">
            <div className="aspect-[5/2] animate-pulse bg-[#EEE9EF]" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-[#EAE4EC]" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-[#F0ECF1]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
