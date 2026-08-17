"use client";

import {useRouter} from "next/navigation";

export default function TravelHero() {
  const router = useRouter();

  const handleAddInvoices = () => {
    router.push("/viajes/nuevo");
  };

  return (
    <section className="mt-10">
      <button
        onClick={handleAddInvoices}
        className="group flex w-full items-center justify-between rounded-[28px] border border-[#eeeae4] bg-white p-6 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(0,0,0,0.07)] active:scale-[0.99] active:bg-[#f8f6f2] sm:p-9"
      >
        <div className="flex items-center gap-5 sm:gap-7">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#f6f1e9] text-3xl transition-transform duration-150 group-active:scale-95">
            📄
          </div>

          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">
              Agregar facturas
            </h2>

            <p className="mt-2 max-w-lg text-sm text-[#77736c] sm:text-base">
              Subí tus facturas y dejá que Crystal Reports
              identifique los datos automáticamente.
            </p>
          </div>
        </div>

        <span className="hidden h-11 w-11 items-center justify-center rounded-full bg-[#f8f5f0] text-xl text-[#a18d6d] transition-all group-hover:bg-[#eee7dc] group-active:scale-90 sm:flex">
          →
        </span>
      </button>
    </section>
  );
}