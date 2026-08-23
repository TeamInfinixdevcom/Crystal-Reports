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
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-50 lg:hidden
        border-t border-white/70
        bg-white/75
        px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]
        backdrop-blur-2xl
        supports-[backdrop-filter]:bg-white/60
        shadow-[0_-8px_30px_rgba(0,0,0,0.05)]
      "
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {items.map((item) => {
          const isActive =
            active === item.id || pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className="
                relative
                flex min-w-[70px]
                flex-col items-center
                gap-1
                rounded-2xl
                px-3 py-2
                transition-all
                duration-300
                ease-[cubic-bezier(0.22,1,0.36,1)]
                active:scale-[0.94]
              "
            >
              {/* Superficie activa */}
              <span
                aria-hidden="true"
                className={`
                  absolute inset-0 -z-10 rounded-2xl
                  transition-all
                  duration-300
                  ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    isActive
                      ? "scale-100 bg-[#f6f1e9] opacity-100 shadow-[0_4px_14px_rgba(161,141,109,0.10)]"
                      : "scale-90 bg-transparent opacity-0"
                  }
                `}
              />

              <span
                className={`
                  text-lg
                  transition-transform
                  duration-300
                  ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    isActive
                      ? "scale-105"
                      : "scale-100"
                  }
                `}
              >
                {item.icon}
              </span>

              <span
                className={`
                  text-[11px]
                  transition-all
                  duration-300
                  ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    isActive
                      ? "font-medium text-[#8f7957]"
                      : "text-[#77736c]"
                  }
                `}
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