"use client";

import Link from "next/link";

export default function QuickAccess() {
  const items = [
    {
      icon: "📄",
      title: "Mis facturas",
      description: "Consultá tus facturas y documentos.",
      href: "/viajes",
    },
    {
      icon: "📊",
      title: "Reportes",
      description: "Consultá tus viáticos y generá expedientes.",
      href: "/reportes",
    },
    {
      icon: "👤",
      title: "Mi perfil",
      description: "Actualizá tu información.",
      href: "/perfil",
    },
  ];

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">
        Accesos rápidos
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group flex items-center justify-between rounded-[24px] border border-[#eeeae4] bg-white p-5 text-left shadow-[0_6px_25px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f6f1e9] text-xl">
                {item.icon}
              </div>

              <div>
                <h3 className="font-medium">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-[#8a857c]">
                  {item.description}
                </p>
              </div>
            </div>

            <span className="text-xl text-[#a18d6d] transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}