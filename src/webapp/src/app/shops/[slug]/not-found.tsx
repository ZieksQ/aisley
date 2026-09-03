import Link from "next/link";

export default function ShopNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 py-20 text-center">
      <h1 className="text-2xl font-bold text-[#2A1C2E]">Shop not found</h1>
      <p className="mt-3 text-sm leading-6 text-[#726776]">
        This shop does not exist or is not currently available to browse.
      </p>
      <Link href="/shops" className="mt-6 inline-flex min-h-10 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
        Browse shops
      </Link>
    </main>
  );
}
