"use client";

import Link from "next/link";

export default function PdfExpedient() {
  return (
    <section className="mt-6">
      <div className="flex flex-col gap-6 rounded-[24px] border border-[#eeeae4] bg-white p-6 shadow-[0_6px_25px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between sm:p-7">

        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#f6f1e9] text-2xl">
            📄
          </div>

          <div>
            <h2 className="font-semibold">
              ¿Necesitás enviar tu expediente?
            </h2>

            <p className="mt-1 max-w-xl text-sm text-[#77736c]">
              Generá tu expediente mensual en un solo PDF
              listo para impresión o respaldo.
            </p>
          </div>
        </div>

        <Link
          href="/reportes"
          className="shrink-0 rounded-xl bg-[#f6f1e9] px-5 py-3 text-center text-sm font-medium text-[#8f7957] transition-all hover:bg-[#eee7dc] active:scale-95"
        >
          Ir a Reportes
        </Link>

      </div>
    </section>
  );
}
