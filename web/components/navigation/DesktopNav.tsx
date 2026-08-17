"use client";

import { usePathname, useRouter } from "next/navigation";

type DesktopNavProps = {
  active?: "inicio" | "viajes" | "reportes" | "perfil";
};

export default function DesktopNav({
  active = "inicio",
}: DesktopNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    { id: "inicio", label: "Inicio", path: "/" },
    { id: "viajes", label: "Mis viajes", path: "/viajes" },
    { id: "reportes", label: "Reportes", path: "/reportes" },
    { id: "perfil", label: "Mi perfil", path: "/perfil" },
  ] as const;

  return (
    <nav className="flex items-center gap-2">
      {items.map((item) => {
        const isActive =
          active === item.id || pathname === item.path;

        return (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            className={
              isActive
                ? "rounded-xl bg-[#f6f1e9] px-5 py-2.5 text-sm font-medium text-[#8f7957] transition-all active:scale-95"
                : "rounded-xl px-5 py-2.5 text-sm text-[#55514a] transition-all hover:bg-[#f6f3ee] active:scale-95"
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}