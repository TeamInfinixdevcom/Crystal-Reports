"use client";

import { usePathname, useRouter } from "next/navigation";

type MobileNavProps = {
  active?: "inicio" | "viajes" | "reportes" | "perfil";
};

export default function MobileNav({
  active = "inicio",
}: MobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const items = [
    {
      id: "inicio",
      label: "Inicio",
      icon: "⌂",
      path: "/",
    },
    {
      id: "viajes",
      label: "Mis viajes",
      icon: "🚗",
      path: "/viajes",
    },
    {
      id: "reportes",
      label: "Reportes",
      icon: "▥",
      path: "/reportes",
    },
    {
      id: "perfil",
      label: "Perfil",
      icon: "♙",
      path: "/perfil",
    },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eeeae4] bg-white/95 px-3 pb-4 pt-3 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const isActive =
            active === item.id || pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`flex min-w-[70px] flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-150 active:scale-90 ${
                isActive
                  ? "bg-[#f6f1e9] text-[#8f7957]"
                  : "text-[#77736c] hover:bg-[#f6f3ee]"
              }`}
            >
              <span className="text-lg">
                {item.icon}
              </span>

              <span
                className={`text-[11px] ${
                  isActive ? "font-medium" : ""
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}